import { memo, useMemo, useState, type CSSProperties } from 'react'
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
import { GripVertical, Plus, RotateCcw, Trash2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useTracker, undo } from '@/store/tracker'
import { addStep, deleteStep, moveStep, resetTemplate, updateStep } from '@/store/upgradeActions'
import {
  PHASES,
  type EnvKey,
  type Phase,
  type Settings,
  type StepKind,
  type TemplateStep,
  type TimeMode,
} from '@/lib/model/types'
import { addDaysIso, formatDay, todayIn } from '@/lib/dates'
import { defaultWindows } from '@/lib/upgrade/logic'

const ANCHOR_LABEL = { dev: 'DEV', uat: 'Test (UAT)', prod: 'PROD' } as const
import { generateTasks, statusCategory } from '@/lib/template/schedule'
import { phaseTone } from '@/theme/brand'
import { Button } from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/misc'
import { Switch } from '@/components/ui/Switch'
import { Tooltip } from '@/components/ui/Tooltip'
import { confirm } from '@/components/ui/confirm'
import { cn } from '@/components/ui/cn'
import { ChoiceCell, NumberCell, PickCell, TextCell } from '@/features/plan/cells'
import { GanttHeader, GanttTrack, computeRange, useElementWidth } from '@/features/plan/gantt'

const COLS = [
  { key: 'handle', label: '', w: 28 },
  { key: 'n', label: '#', w: 32 },
  { key: 'name', label: 'Step', w: 330 },
  { key: 'phase', label: 'Phase', w: 118 },
  { key: 'kind', label: 'Kind', w: 108 },
  { key: 'anchor', label: 'Anchor', w: 82 },
  { key: 'offset', label: 'Offset (days)', w: 92 },
  { key: 'duration', label: 'Days', w: 64 },
  { key: 'owner', label: 'Owner', w: 116 },
  { key: 'assignee', label: 'Assignee', w: 108 },
  { key: 'weekend', label: 'Skip weekend', w: 96 },
  { key: 'time', label: 'Time', w: 150 },
  { key: 'actions', label: '', w: 34 },
] as const
const TOTAL = COLS.reduce((s, c) => s + c.w, 0)

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const StepRow = memo(function StepRow({
  step,
  index,
  settings,
}: {
  step: TemplateStep
  index: number
  settings: Settings
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  const up = (patch: Partial<TemplateStep>) => updateStep(step.id, patch)
  const tone = phaseTone[step.phase]

  return (
    <div
      ref={setNodeRef}
      data-row
      style={style}
      className={cn(
        'group flex h-11 items-center border-b border-border/60 bg-surface',
        isDragging && 'relative z-20 shadow-lift',
      )}
    >
      {COLS.map((c) => (
        <div key={c.key} className="flex min-w-0 items-center px-0.5" style={{ width: c.w }}>
          {c.key === 'handle' && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag to reorder ${step.name}`}
              className="flex h-8 w-6 cursor-grab items-center justify-center text-subtle opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {c.key === 'n' && (
            <span className="flex items-center gap-1.5 pl-1 text-xs text-subtle tabular">
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: `var(--tone-${tone}-solid)` }}
              />
              {index + 1}
            </span>
          )}
          {c.key === 'name' && (
            <TextCell
              col="name"
              value={step.name}
              ariaLabel="Step name"
              onCommit={(name) => name && up({ name })}
              className="w-full"
            />
          )}
          {c.key === 'phase' && (
            <ChoiceCell<Phase>
              col="phase"
              value={step.phase}
              ariaLabel="Phase"
              options={PHASES.map((p) => ({ value: p, label: p }))}
              onCommit={(phase) => up({ phase })}
            />
          )}
          {c.key === 'kind' && (
            <ChoiceCell<StepKind>
              col="kind"
              value={step.kind}
              ariaLabel="Kind"
              options={[
                { value: 'task', label: 'Task' },
                { value: 'milestone', label: 'Milestone' },
              ]}
              onCommit={(kind) => up({ kind })}
            />
          )}
          {c.key === 'anchor' && (
            <ChoiceCell<EnvKey>
              col="anchor"
              value={step.anchor}
              ariaLabel="Anchor window"
              options={(['dev', 'uat', 'prod'] as const).map((e) => ({
                value: e,
                label: ANCHOR_LABEL[e],
              }))}
              onCommit={(anchor) => up({ anchor })}
            />
          )}
          {c.key === 'offset' && (
            <NumberCell
              col="offset"
              value={step.offsetDays}
              ariaLabel="Offset in days"
              onCommit={(offsetDays) => up({ offsetDays })}
            />
          )}
          {c.key === 'duration' && (
            <NumberCell
              col="duration"
              value={step.durationDays}
              min={1}
              disabled={step.kind === 'milestone'}
              ariaLabel="Duration in days"
              onCommit={(durationDays) => up({ durationDays })}
            />
          )}
          {c.key === 'owner' && (
            <PickCell
              col="owner"
              value={step.defaultOwner}
              options={settings.owners}
              ariaLabel="Default owner"
              onCommit={(defaultOwner) => up({ defaultOwner })}
            />
          )}
          {c.key === 'assignee' && (
            <PickCell
              col="assignee"
              value={step.defaultAssignee}
              options={settings.assignees}
              ariaLabel="Default assignee"
              onCommit={(defaultAssignee) => up({ defaultAssignee })}
            />
          )}
          {c.key === 'weekend' && (
            <div className="flex w-full justify-center">
              <Switch
                checked={step.avoidWeekend}
                onCheckedChange={(avoidWeekend) => up({ avoidWeekend })}
                label="Move off weekends"
              />
            </div>
          )}
          {c.key === 'time' && (
            <div className="flex w-full items-center gap-1">
              <div className="flex-1">
                <ChoiceCell<TimeMode>
                  col="time"
                  value={step.timeMode}
                  ariaLabel="Time of day"
                  options={[
                    { value: 'none', label: 'Date only' },
                    { value: 'window', label: 'Window time' },
                    { value: 'fixed', label: 'Fixed time' },
                  ]}
                  onCommit={(timeMode) => up({ timeMode })}
                />
              </div>
              {step.timeMode === 'fixed' && (
                <input
                  type="time"
                  aria-label="Fixed time"
                  defaultValue={step.fixedTime ?? '10:00'}
                  key={step.fixedTime}
                  onBlur={(e) =>
                    e.target.value &&
                    e.target.value !== step.fixedTime &&
                    up({ fixedTime: e.target.value })
                  }
                  className="h-8 w-[4.6rem] rounded-md border border-border bg-surface px-1 text-xs tabular focus:border-accent focus:outline-none"
                />
              )}
            </div>
          )}
          {c.key === 'actions' && (
            <Tooltip content="Delete step">
              <button
                type="button"
                aria-label={`Delete ${step.name}`}
                onClick={() => {
                  deleteStep(step.id)
                  toast('Step deleted', { action: { label: 'Undo', onClick: undo } })
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-subtle opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      ))}
    </div>
  )
})

function Preview() {
  const settings = useTracker((s) => s.doc.settings)
  const template = useTracker((s) => s.doc.template)
  const today = todayIn(settings.displayTimeZone)
  const [withUat, setWithUat] = useState(true)
  const base = useMemo(() => defaultWindows(today, settings), [today, settings])
  const windows = useMemo(() => (withUat ? base : { ...base, uat: null }), [base, withUat])
  const tasks = useMemo(
    () => generateTasks({ template, windows, family: 'Australia', settings }),
    [template, windows, settings],
  )
  const range = useMemo(
    () =>
      computeRange(
        [...tasks.flatMap((t) => [t.start, t.end]), addDaysIso(windows.prod.start.slice(0, 10), 2)],
        today,
      ),
    [tasks, windows, today],
  )
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const nameW = 300
  const dayW = Math.max(14, Math.floor((width - nameW - 4) / range.days))

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <h2 className="font-semibold">Live preview</h2>
        <span className="text-xs text-muted">
          Sample: DEV {formatDay(windows.dev.start.slice(0, 10))}
          {windows.uat ? `, UAT ${formatDay(windows.uat.start.slice(0, 10))}` : ', no UAT'}, PROD{' '}
          {formatDay(windows.prod.start.slice(0, 10))}
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <Switch checked={withUat} onCheckedChange={setWithUat} label="Sample has UAT" /> Sample
          has UAT
        </label>
      </div>
      <div
        ref={ref}
        className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface"
      >
        <div style={{ minWidth: nameW + range.days * dayW }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface-2">
            <div className="eyebrow sticky left-0 z-10 flex w-[300px] shrink-0 items-end border-r border-border bg-surface-2 px-3 pb-1.5">
              Step
            </div>
            <GanttHeader range={range} dayW={dayW} today={today} />
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="flex border-b border-border/50">
              <div
                className={cn(
                  'sticky left-0 z-[1] flex w-[300px] shrink-0 items-center justify-between gap-2 border-r border-border bg-surface px-3 text-xs',
                  !t.start && 'text-subtle',
                )}
                style={{ height: 30 }}
              >
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-subtle tabular">
                  {t.start ? formatDay(t.start, 'EEE d MMM') : 'N/A'}
                </span>
              </div>
              <GanttTrack
                range={range}
                dayW={dayW}
                today={today}
                height={30}
                bar={{
                  start: t.start,
                  end: t.end,
                  phase: t.phase,
                  milestone: t.kind === 'milestone',
                  category: statusCategory(settings.taskStatuses, t.status),
                  label: t.name,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TemplatePage() {
  const steps = useTracker((s) => s.doc.template.steps)
  const settings = useTracker((s) => s.doc.settings)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) moveStep(String(e.active.id), String(e.over.id))
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-3 md:p-6">
      <SectionTitle
        eyebrow="Standard plan"
        title="Upgrade template"
        actions={
          <>
            <Button
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Reset the template?',
                    body: 'All steps go back to the standard 24 steps. Existing upgrades are not changed.',
                    confirmLabel: 'Reset template',
                    danger: true,
                  })
                )
                  resetTemplate()
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset to standard
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = addStep()
                setTimeout(() => {
                  const el = document.querySelector<HTMLInputElement>(
                    `[data-step-id="${id}"] input`,
                  )
                  el?.scrollIntoView?.({ block: 'center' })
                  el?.select()
                }, 80)
              }}
            >
              <Plus className="h-4 w-4" /> Add step
            </Button>
          </>
        }
      />
      <p className="flex items-center gap-2 text-xs text-muted">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Offsets are calendar days from the anchor window (negative = before).{' '}
        <code className="rounded bg-surface-3 px-1">{'{family}'}</code> becomes the target release,{' '}
        <code className="rounded bg-surface-3 px-1">{'{test}'}</code> the customer's name for the
        test environment (UAT, TEST, STAG, PRP...). Changes apply to new upgrades; use “Apply
        template” on a plan to update an existing one.
      </p>

      <div
        data-grid
        className="min-h-0 flex-[3] overflow-auto rounded-xl border border-border bg-surface"
      >
        <div style={{ minWidth: TOTAL }}>
          <div className="sticky top-0 z-10 flex h-9 items-end border-b border-border bg-surface-2 pb-1.5">
            {COLS.map((c) => (
              <div key={c.key} className="eyebrow truncate px-2.5" style={{ width: c.w }}>
                {c.label}
              </div>
            ))}
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            modifiers={[verticalOnly]}
          >
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {steps.map((s, i) => (
                <div key={s.id} data-step-id={s.id}>
                  <StepRow step={s} index={i} settings={settings} />
                </div>
              ))}
            </SortableContext>
          </DndContext>
          {steps.length === 0 && (
            <p className="p-6 text-center text-sm text-subtle">
              No steps. Add one or reset to the standard template.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-[2] flex-col">
        <Preview />
      </div>
    </div>
  )
}
