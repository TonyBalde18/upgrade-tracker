import { memo } from 'react'
import {
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import {
  ArrowRight,
  Check,
  CircleDashed,
  GripVertical,
  MinusCircle,
  OctagonAlert,
  ExternalLink,
} from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { updateTask } from '@/store/upgradeActions'
import { addDaysIso, formatDay, isoWeekOf, parseDay, zoneAbbr, zonedToInstant } from '@/lib/dates'
import { firstStatusOf, statusCategory } from '@/lib/template/schedule'
import { phaseTone } from '@/theme/brand'
import { useReducedMotion } from '@/theme/motion'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { cn } from '@/components/ui/cn'
import { StatusCell } from '@/features/plan/cells'
import {
  HEADER_W,
  type AxisNode,
  type FlowEdge,
  type LaneNode,
  type PhaseNode,
  type TodayNode,
} from './graph'

const PHASE_LABEL: Record<string, string> = { 'Go-live': 'Go / No-Go' }

// --- lane -----------------------------------------------------------------------

export const LaneNodeView = memo(function LaneNodeView({ data }: NodeProps<LaneNode>) {
  const { upgrade, customer, status, progress, width, height, layout } = data
  const color = customer?.color ?? '#94A3B8'
  return (
    <div
      className="relative rounded-2xl border border-border bg-surface/40"
      style={{
        width,
        height,
        backgroundImage: `linear-gradient(90deg, ${color}14, transparent 320px)`,
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !min-w-0 !border-0 !bg-transparent"
        style={{ left: HEADER_W - 22, right: 'auto', top: 54 }}
      />
      <div
        className="lane-handle absolute top-0 bottom-0 left-0 flex flex-col justify-center gap-2 rounded-l-2xl border-r border-border bg-surface/90 py-3 pr-3 pl-5"
        style={{ width: HEADER_W - 20, cursor: layout === 'free' ? 'grab' : 'default' }}
      >
        <span
          className="absolute top-3 bottom-3 left-0 w-1.5 rounded-r-full"
          style={{ backgroundColor: color }}
        />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="eyebrow truncate" style={{ color }}>
              {customer?.shortName ?? ''}
            </div>
            <div className="truncate font-heading text-[0.95rem] font-bold">
              {customer?.name ?? 'Unknown customer'}
            </div>
          </div>
          {layout === 'free' && (
            <GripVertical className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          {upgrade.fromFamily} <ArrowRight className="h-3 w-3 text-accent-text" /> {upgrade.family}
          <span className="text-subtle">· {upgrade.cycle}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={status} size="sm" />
          <ProgressRing value={progress} size={34} stroke={3.5} />
        </div>
        <Link
          to={`/upgrades/${upgrade.id}`}
          className="nodrag flex items-center gap-1 text-[0.7rem] text-subtle hover:text-accent-text"
        >
          Open plan <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
})

// --- phase ----------------------------------------------------------------------

function shortRange(start: string, end: string): string {
  if (start === end) return formatDay(start, 'EEE d MMM')
  return `${formatDay(start, 'd MMM')} → ${formatDay(end, 'd MMM')}`
}

export const PhaseNodeView = memo(function PhaseNodeView({ data }: NodeProps<PhaseNode>) {
  const { step, tasks, windowStart, windowZone, expanded, width, upgradeId, layout } = data
  const settings = useTracker((s) => s.doc.settings)
  const reduced = useReducedMotion()
  const tone = phaseTone[step.phase]
  const span = step.span
  const label = PHASE_LABEL[step.phase] ?? step.phase
  const doneId = firstStatusOf(settings.taskStatuses, 'done')?.id
  const plannedId = firstStatusOf(settings.taskStatuses, 'planned')?.id
  const compact = layout === 'time' && width < 170

  let zone = ''
  if (windowStart && windowZone) {
    try {
      zone = zoneAbbr(windowZone, zonedToInstant(windowStart, windowZone))
    } catch {
      zone = ''
    }
  }

  const stateCls = {
    done: 'border-transparent text-[#0F0100]',
    current: cn('border-accent bg-surface shadow-glow', !reduced && 'node-pulse'),
    future: 'bg-surface/80 border-dashed',
    blocked: 'bg-problem-stripes border-danger bg-surface',
    na: 'border-dashed border-border-strong bg-transparent text-subtle',
  }[step.state]

  return (
    <div
      className={cn(
        'relative cursor-pointer rounded-[14px] border-2 px-3.5 py-2.5 transition-shadow hover:shadow-lift',
        stateCls,
      )}
      style={{
        width,
        backgroundColor: step.state === 'done' ? `var(--tone-${tone}-solid)` : undefined,
        borderColor: step.state === 'future' ? `var(--tone-${tone}-solid)` : undefined,
      }}
      title={`${label}: click to ${expanded ? 'collapse' : 'expand'}, double-click to open the plan`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2 !w-2 !min-w-0 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !min-w-0 !border-0 !bg-transparent"
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'eyebrow truncate',
            step.state === 'done'
              ? '!text-[#0F0100]/75'
              : step.state === 'current'
                ? '!text-accent-text'
                : '',
          )}
          style={step.state === 'future' ? { color: `var(--tone-${tone}-fg)` } : undefined}
        >
          {label}
        </span>
        {step.state === 'done' && <Check className="h-4 w-4 shrink-0" aria-label="Done" />}
        {step.state === 'current' && (
          <span
            className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-accent text-accent"
            aria-label="Current phase"
          />
        )}
        {step.state === 'blocked' && (
          <OctagonAlert className="h-4 w-4 shrink-0 text-danger" aria-label="Blocked" />
        )}
        {step.state === 'future' && (
          <CircleDashed className="h-4 w-4 shrink-0 text-subtle" aria-label="Not started" />
        )}
        {step.state === 'na' && (
          <MinusCircle className="h-4 w-4 shrink-0" aria-label="Not applicable" />
        )}
      </div>

      {span ? (
        <>
          {!compact && (
            <div className="mt-1 text-sm font-semibold tabular">
              {shortRange(span.start, span.end)}
            </div>
          )}
          {windowStart && !compact && (
            <div
              className={cn(
                'text-[0.7rem] tabular',
                step.state === 'done' ? 'text-[#0F0100]/70' : 'text-muted',
              )}
            >
              ◆ {formatDay(windowStart.slice(0, 10), 'EEE d MMM')} {windowStart.slice(11, 16)}{' '}
              {zone}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className={cn(
                'h-1 flex-1 overflow-hidden rounded-full',
                step.state === 'done' ? 'bg-[#0F0100]/15' : 'bg-surface-3',
              )}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(span.done / span.total) * 100}%`,
                  backgroundColor: step.state === 'done' ? '#0F0100' : `var(--tone-${tone}-solid)`,
                }}
              />
            </div>
            <span className="text-[0.68rem] tabular">
              {span.done}/{span.total}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-1 text-sm">N/A</div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="nodrag nopan nowheel -mx-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <ul
              className="mt-2.5 flex flex-col gap-1 rounded-lg bg-surface p-1 text-text shadow-card"
              style={{ minWidth: 300 }}
            >
              {tasks.map((t) => {
                const cat = statusCategory(settings.taskStatuses, t.status)
                const done = cat === 'done'
                return (
                  <li
                    key={t.id}
                    className="flex h-8 items-center gap-1.5 rounded-md px-1 hover:bg-surface-2"
                  >
                    <button
                      type="button"
                      disabled={cat === 'na'}
                      onClick={() => {
                        const next = done ? plannedId : doneId
                        if (next) updateTask(upgradeId, t.id, { status: next })
                      }}
                      aria-label={done ? `Mark "${t.name}" not done` : `Mark "${t.name}" done`}
                      className={cn(
                        'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-default disabled:opacity-40',
                        done
                          ? 'border-success bg-success text-[#0F0100]'
                          : 'border-border-strong hover:border-success',
                      )}
                    >
                      {done && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </motion.span>
                      )}
                    </button>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-xs',
                        done && 'text-subtle line-through',
                      )}
                      title={t.name}
                    >
                      {t.name}
                    </span>
                    <span className="shrink-0 text-[0.65rem] text-subtle tabular">
                      {t.start ? formatDay(t.start, 'd MMM') : 'N/A'}
                    </span>
                    <StatusCell
                      value={t.status}
                      statuses={settings.taskStatuses}
                      ariaLabel={`Status of ${t.name}`}
                      onCommit={(status) => updateTask(upgradeId, t.id, { status })}
                    />
                  </li>
                )
              })}
              {tasks.length === 0 && <li className="p-2 text-xs text-subtle">No tasks.</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// --- time axis + today ------------------------------------------------------------

export const AxisNodeView = memo(function AxisNodeView({ data }: NodeProps<AxisNode>) {
  const { start, days, px, today } = data
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => addDaysIso(start, i * 7))
  return (
    <div className="pointer-events-none relative h-12 select-none" style={{ width: days * px }}>
      {weeks.map((w, i) => {
        const first = i === 0 || w.slice(5, 7) !== weeks[i - 1]!.slice(5, 7)
        const current = isoWeekOf(today).monday === w
        return (
          <div
            key={w}
            className="absolute top-0 h-12 border-l border-border"
            style={{ left: i * 7 * px, width: 7 * px }}
          >
            {first && (
              <div className="px-1.5 text-xs font-semibold whitespace-nowrap">
                {format(parseDay(w), 'MMMM yyyy')}
              </div>
            )}
            <div
              className={cn(
                'absolute bottom-1 px-1.5 text-[0.65rem] tabular',
                current ? 'font-bold text-accent-text' : 'text-subtle',
              )}
            >
              W{isoWeekOf(w).week} · {formatDay(w, 'd MMM')}
            </div>
          </div>
        )
      })}
    </div>
  )
})

export const TodayNodeView = memo(function TodayNodeView({ data }: NodeProps<TodayNode>) {
  return (
    <div className="pointer-events-none relative" style={{ height: data.height, width: 2 }}>
      <div className="absolute inset-0 bg-accent shadow-[0_0_14px_var(--ut-accent-glow)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 rounded bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wider text-accent-fg uppercase">
        Today
      </div>
    </div>
  )
})

// --- edge -------------------------------------------------------------------------

export const FlowEdgeView = memo(function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdge>) {
  const reduced = useReducedMotion()
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const state = data?.state ?? 'future'
  if (state === 'active') {
    return (
      <g>
        <path
          d={path}
          fill="none"
          stroke="var(--ut-accent-glow)"
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.35}
        />
        <BaseEdge
          id={id}
          path={path}
          style={{ stroke: 'var(--ut-accent)', strokeWidth: 3 }}
          className={reduced ? '' : 'flow-edge-active'}
        />
        {!reduced && (
          <circle r={4.5} fill="#FF6B6B">
            <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
          </circle>
        )}
      </g>
    )
  }
  const style =
    state === 'done'
      ? { stroke: 'var(--ut-border-strong)', strokeWidth: 2.5 }
      : state === 'na'
        ? { stroke: 'var(--ut-border)', strokeWidth: 1.5, strokeDasharray: '2 5' }
        : { stroke: 'var(--ut-border-strong)', strokeWidth: 1.5, strokeDasharray: '6 6' }
  return <BaseEdge id={id} path={path} style={style} />
})

export const nodeTypes = {
  lane: LaneNodeView,
  phase: PhaseNodeView,
  axis: AxisNodeView,
  today: TodayNodeView,
}
export const edgeTypes = { flow: FlowEdgeView }
