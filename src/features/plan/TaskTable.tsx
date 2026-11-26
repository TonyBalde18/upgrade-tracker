import { AnimatePresence, motion } from 'motion/react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Diamond, ExternalLink, GripVertical, Hand, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  PHASES,
  type Customer,
  type Phase,
  type Settings,
  type Task,
  type Template,
  type Upgrade,
} from '@/lib/model/types'
import { phaseTone } from '@/theme/brand'
import { statusCategory } from '@/lib/template/schedule'
import { diffDaysIso, zoneAbbr } from '@/lib/dates'
import { addTask, deleteTask, reorderTask, updateTask } from '@/store/upgradeActions'
import { undo } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { phaseLabel } from '@/lib/upgrade/logic'
import { BulkBar } from './BulkBar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'
import { DateCell, PickCell, StatusCell, TextCell, TimeCell } from './cells'
import { GanttHeader, GanttTrack, computeRange, useElementWidth, type DayRange } from './gantt'

export type TableMode = 'split' | 'table'

interface Col {
  key: string
  label: string
  width: number
}

const COLS: Record<TableMode, Col[]> = {
  split: [
    { key: 'select', label: '', width: 26 },
    { key: 'handle', label: '', width: 22 },
    { key: 'name', label: 'Step', width: 260 },
    { key: 'assignedTo', label: 'Assigned to', width: 116 },
    { key: 'status', label: 'Status', width: 148 },
    { key: 'start', label: 'Start', width: 124 },
    { key: 'end', label: 'End', width: 124 },
    { key: 'actions', label: '', width: 34 },
  ],
  table: [
    { key: 'select', label: '', width: 26 },
    { key: 'handle', label: '', width: 22 },
    { key: 'name', label: 'Step', width: 300 },
    { key: 'owner', label: 'Owner', width: 116 },
    { key: 'assignee', label: 'Assignee', width: 108 },
    { key: 'assignedTo', label: 'Assigned to', width: 124 },
    { key: 'status', label: 'Status', width: 148 },
    { key: 'start', label: 'Start', width: 124 },
    { key: 'end', label: 'End', width: 124 },
    { key: 'time', label: 'Time', width: 88 },
    { key: 'notes', label: 'Notes', width: 220 },
    { key: 'link', label: 'Link', width: 170 },
    { key: 'actions', label: '', width: 34 },
  ],
}

const ROW_H = 44
const ROW_H_COMPACT = 32

/** Only http(s) links are rendered as links (never javascript: or data:). */
export function safeUrl(u: string): string | null {
  const s = u.trim()
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

interface RowProps {
  task: Task
  upgradeId: string
  settings: Settings
  cols: Col[]
  leftWidth: number
  gantt: { range: DayRange; dayW: number; today: string } | null
  anchorZone: string
  highlight: boolean
  onStatus: (task: Task, status: string) => void
  selected: boolean
  onSelect: (taskId: string, on: boolean, range: boolean) => void
  rowH: number
}

const TaskRow = memo(function TaskRow({
  task,
  upgradeId,
  settings,
  cols,
  leftWidth,
  gantt,
  anchorZone,
  highlight,
  onStatus,
  selected,
  onSelect,
  rowH,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    height: rowH,
  }
  const cat = statusCategory(settings.taskStatuses, task.status)
  const upd = (patch: Partial<Task>) => updateTask(upgradeId, task.id, patch)
  const url = safeUrl(task.link)

  const cell = (c: Col): ReactNode => {
    switch (c.key) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => undefined}
            onClick={(e) => onSelect(task.id, !selected, e.shiftKey)}
            aria-label={`Select ${task.name}`}
            className={cn(
              'ml-1 h-3.5 w-3.5 cursor-pointer accent-[var(--ut-accent)]',
              !selected && 'opacity-30 group-hover:opacity-100 focus:opacity-100',
            )}
          />
        )
      case 'handle':
        return (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${task.name}`}
            className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-subtle opacity-0 group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )
      case 'name':
        return (
          <div className="flex min-w-0 items-center gap-1">
            {task.kind === 'milestone' && (
              <Tooltip content="Milestone">
                <Diamond
                  className="h-3 w-3 shrink-0 fill-current"
                  style={{ color: `var(--tone-${phaseTone[task.phase]}-solid)` }}
                  aria-label="Milestone"
                />
              </Tooltip>
            )}
            <TextCell
              col="name"
              value={task.name}
              ariaLabel="Step name"
              onCommit={(v) => v && upd({ name: v })}
              className="flex-1"
            />
            {task.time && (
              <Tooltip
                content={`${task.time.start}${task.time.end ? ` to ${task.time.end}` : ''} ${zoneAbbr(task.time.timeZone)} (${task.time.timeZone})`}
              >
                <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[0.65rem] text-muted tabular">
                  {task.time.start}
                </span>
              </Tooltip>
            )}
            {task.datesManuallySet && task.templateStepId && (
              <Tooltip content="Dates set by hand: kept when recalculating unless you choose to overwrite">
                <Hand className="h-3 w-3 shrink-0 text-subtle" aria-label="Dates set by hand" />
              </Tooltip>
            )}
          </div>
        )
      case 'owner':
        return (
          <PickCell
            col="owner"
            value={task.owner}
            options={settings.owners}
            ariaLabel="Owner"
            onCommit={(owner) => upd({ owner })}
          />
        )
      case 'assignee':
        return (
          <PickCell
            col="assignee"
            value={task.assignee}
            options={settings.assignees}
            ariaLabel="Assignee"
            onCommit={(assignee) => upd({ assignee })}
          />
        )
      case 'assignedTo':
        return (
          <PickCell
            col="assignedTo"
            value={task.assignedTo}
            options={settings.people}
            emptyLabel="Nobody"
            ariaLabel="Assigned to"
            onCommit={(assignedTo) => upd({ assignedTo })}
          />
        )
      case 'status':
        return (
          <StatusCell
            col="status"
            value={task.status}
            statuses={settings.taskStatuses}
            ariaLabel="Status"
            onCommit={(s) => onStatus(task, s)}
          />
        )
      case 'start':
        return (
          <DateCell
            col="start"
            value={task.start}
            ariaLabel="Start date"
            onCommit={(start) => upd({ start })}
          />
        )
      case 'end':
        return (
          <DateCell
            col="end"
            value={task.end}
            ariaLabel="End date"
            onCommit={(end) => upd({ end })}
          />
        )
      case 'time':
        return (
          <TimeCell
            col="time"
            value={task.time?.start ?? null}
            ariaLabel="Time"
            title={task.time ? `${task.time.timeZone}` : `Zone: ${anchorZone}`}
            onCommit={(v) =>
              upd({
                time: v
                  ? {
                      start: v,
                      end: task.time?.end ?? null,
                      timeZone: task.time?.timeZone ?? anchorZone,
                    }
                  : null,
              })
            }
          />
        )
      case 'notes':
        return (
          <TextCell
            col="notes"
            value={task.notes}
            placeholder="Add notes…"
            ariaLabel="Notes"
            onCommit={(notes) => upd({ notes })}
          />
        )
      case 'link':
        return (
          <div className="flex min-w-0 items-center">
            <TextCell
              col="link"
              value={task.link}
              placeholder="https://…"
              ariaLabel="Link"
              onCommit={(link) => upd({ link })}
              className="flex-1"
            />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 p-1 text-subtle hover:text-accent-text"
                aria-label="Open link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )
      case 'actions':
        return (
          <Tooltip content="Delete task">
            <button
              type="button"
              aria-label={`Delete ${task.name}`}
              onClick={() => {
                deleteTask(upgradeId, task.id)
                toast('Task deleted', { action: { label: 'Undo', onClick: undo } })
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-subtle opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )
      default:
        return null
    }
  }

  return (
    <motion.div
      ref={setNodeRef}
      data-row
      data-task-id={task.id}
      style={style}
      initial={highlight ? { backgroundColor: 'var(--ut-accent-soft)' } : false}
      animate={{ backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: highlight ? 2.4 : 0 }}
      className={cn(
        'group flex border-b border-border/60',
        isDragging && 'relative z-30 shadow-lift',
        cat === 'na' && 'opacity-55',
        selected && 'bg-accent-soft/60',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-0 bg-surface',
          selected && 'bg-accent-soft',
          gantt && 'sticky left-0 z-10 border-r border-border',
        )}
        style={{ width: leftWidth }}
      >
        {cols.map((c) => (
          <div key={c.key} className="flex min-w-0 items-center px-0.5" style={{ width: c.width }}>
            {cell(c)}
          </div>
        ))}
      </div>
      {gantt && (
        <GanttTrack
          range={gantt.range}
          dayW={gantt.dayW}
          today={gantt.today}
          height={rowH - 1}
          bar={{
            start: task.start,
            end: task.end,
            phase: task.phase,
            milestone: task.kind === 'milestone',
            category: cat,
            label: task.name,
            detail: [task.assignedTo, task.owner, task.assignee].filter(Boolean).join(' · '),
          }}
        />
      )}
    </motion.div>
  )
})

export function TaskTable({
  upgrade,
  settings,
  template,
  mode,
  today,
  highlightTaskId,
  onStatus,
  customer,
}: {
  upgrade: Upgrade
  settings: Settings
  template: Template
  mode: TableMode
  today: string
  highlightTaskId: string | null
  onStatus: (task: Task, status: string) => void
  customer?: Customer
}) {
  const [collapsed, setCollapsed] = useState<Set<Phase>>(new Set())
  const compact = useUi((s) => s.compact)
  const rowH = compact ? ROW_H_COMPACT : ROW_H
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastPicked, setLastPicked] = useState<string | null>(null)
  const { ref: scrollRef, width } = useElementWidth<HTMLDivElement>()
  const cols = COLS[mode]
  const leftWidth = cols.reduce((s, c) => s + c.width, 0)

  const sorted = useMemo(
    () => [...upgrade.tasks].sort((a, b) => a.order - b.order),
    [upgrade.tasks],
  )
  const groups = useMemo(
    () => PHASES.map((phase) => ({ phase, tasks: sorted.filter((t) => t.phase === phase) })),
    [sorted],
  )
  // the visible order, for shift-click ranges
  const ordered = useMemo(() => groups.flatMap((g) => g.tasks.map((t) => t.id)), [groups])

  // forget selected steps that were deleted
  useEffect(() => {
    setSelected((s) => {
      const keep = [...s].filter((id) => upgrade.tasks.some((t) => t.id === id))
      return keep.length === s.size ? s : new Set(keep)
    })
  }, [upgrade.tasks])

  const onSelect = useCallback(
    (taskId: string, on: boolean, range: boolean) => {
      setSelected((s) => {
        const n = new Set(s)
        if (range && lastPicked) {
          const a = ordered.indexOf(lastPicked)
          const b = ordered.indexOf(taskId)
          if (a >= 0 && b >= 0)
            for (const id of ordered.slice(Math.min(a, b), Math.max(a, b) + 1)) n.add(id)
        } else if (on) n.add(taskId)
        else n.delete(taskId)
        return n
      })
      setLastPicked(taskId)
    },
    [lastPicked, ordered],
  )

  const range = useMemo(
    () =>
      computeRange(
        [
          ...sorted.flatMap((t) => [t.start, t.end]),
          upgrade.windows.dev.start.slice(0, 10),
          upgrade.windows.uat?.start.slice(0, 10),
          upgrade.windows.prod.start.slice(0, 10),
        ],
        today,
      ),
    [sorted, upgrade.windows, today],
  )
  const dayW = Math.max(18, Math.floor((width - leftWidth - 4) / range.days))
  const gantt = useMemo(
    () => (mode === 'split' ? { range, dayW, today } : null),
    [mode, range, dayW, today],
  )

  const stepAnchor = useMemo(
    () => new Map(template.steps.map((s) => [s.id, s.anchor])),
    [template.steps],
  )
  const zoneOf = (t: Task) => {
    const env = (t.templateStepId && stepAnchor.get(t.templateStepId)) || 'dev'
    return upgrade.windows[env]?.timeZone ?? upgrade.windows.dev.timeZone
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id)
      reorderTask(upgrade.id, String(e.active.id), String(e.over.id))
  }

  // bring a task from search (?task=) into view
  useEffect(() => {
    if (!highlightTaskId) return
    const t = upgrade.tasks.find((x) => x.id === highlightTaskId)
    if (t && collapsed.has(t.phase))
      setCollapsed((s) => new Set([...s].filter((p) => p !== t.phase)))
    const id = setTimeout(() => {
      document
        .querySelector(`[data-task-id="${highlightTaskId}"]`)
        ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }, 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTaskId])

  const toggle = (p: Phase) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {selected.size > 0 && (
        <BulkBar
          upgradeId={upgrade.id}
          settings={settings}
          ids={[...selected]}
          onClear={() => setSelected(new Set())}
          onSelectAll={() => setSelected(new Set(ordered))}
          total={ordered.length}
        />
      )}
      <div
        ref={scrollRef}
        data-grid
        className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface"
      >
        <div style={{ minWidth: leftWidth + (gantt ? range.days * dayW : 0) }}>
          {/* header */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-surface-2">
            <div
              className={cn(
                'flex shrink-0 items-end bg-surface-2 pb-1.5',
                gantt && 'sticky left-0 z-30 border-r border-border',
              )}
              style={{ width: leftWidth, height: gantt ? 48 : 36 }}
            >
              {cols.map((c) => (
                <div key={c.key} className="eyebrow truncate px-2.5" style={{ width: c.width }}>
                  {c.label}
                </div>
              ))}
            </div>
            {gantt && <GanttHeader range={range} dayW={dayW} today={today} />}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            modifiers={[verticalOnly]}
          >
            {groups.map(({ phase, tasks }) => {
              const isCollapsed = collapsed.has(phase)
              const done = tasks.filter(
                (t) => statusCategory(settings.taskStatuses, t.status) === 'done',
              ).length
              const relevant = tasks.filter(
                (t) => statusCategory(settings.taskStatuses, t.status) !== 'na',
              ).length
              const tone = phaseTone[phase]
              const starts = tasks
                .map((t) => t.start)
                .filter((d): d is string => !!d)
                .sort()
              const ends = tasks
                .map((t) => t.end)
                .filter((d): d is string => !!d)
                .sort()
              return (
                <section key={phase} aria-label={`${phase} phase`}>
                  <div className="flex h-10 border-b border-border bg-surface">
                    <div
                      className={cn(
                        'flex shrink-0 items-center gap-2 bg-surface px-2',
                        gantt && 'sticky left-0 z-10 border-r border-border',
                      )}
                      style={{ width: leftWidth }}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(phase)}
                        aria-expanded={!isCollapsed}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 text-left"
                      >
                        <motion.span
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        >
                          <ChevronRight className="h-4 w-4 text-subtle" />
                        </motion.span>
                        <span
                          className="h-2.5 w-2.5 rounded-[3px]"
                          style={{ backgroundColor: `var(--tone-${tone}-solid)` }}
                          aria-hidden
                        />
                        <span className="font-heading text-sm font-semibold">
                          {phaseLabel(phase, customer)}
                        </span>
                        <span className="text-xs text-subtle tabular">
                          {done}/{relevant} done
                        </span>
                      </button>
                      <Tooltip content={`Add a task to ${phaseLabel(phase, customer)}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsed) toggle(phase)
                            const id = addTask(upgrade.id, phase)
                            setTimeout(
                              () =>
                                document
                                  .querySelector<HTMLInputElement>(
                                    `[data-task-id="${id}"] [data-col="name"] input`,
                                  )
                                  ?.select(),
                              80,
                            )
                          }}
                          className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-subtle hover:bg-surface-2 hover:text-text"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      </Tooltip>
                    </div>
                    {gantt && starts[0] && (
                      <div className="relative" style={{ width: range.days * dayW }}>
                        <div
                          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-40"
                          style={{
                            left: diffDaysIso(starts[0], range.start) * dayW,
                            width:
                              (diffDaysIso(ends[ends.length - 1] ?? starts[0], starts[0]) + 1) *
                              dayW,
                            backgroundColor: `var(--tone-${tone}-solid)`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                        className="overflow-hidden"
                      >
                        <SortableContext
                          items={tasks.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {tasks.map((t) => (
                            <TaskRow
                              key={t.id}
                              task={t}
                              upgradeId={upgrade.id}
                              settings={settings}
                              cols={cols}
                              leftWidth={leftWidth}
                              gantt={gantt}
                              anchorZone={zoneOf(t)}
                              highlight={t.id === highlightTaskId}
                              onStatus={onStatus}
                              selected={selected.has(t.id)}
                              onSelect={onSelect}
                              rowH={rowH}
                            />
                          ))}
                        </SortableContext>
                        {tasks.length === 0 && (
                          <div className="px-12 py-3 text-xs text-subtle">
                            No tasks in this phase.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              )
            })}
          </DndContext>
        </div>
      </div>
    </div>
  )
}
