import { memo } from 'react'
import { Link } from 'react-router'
import { Diamond, Phone } from 'lucide-react'
import type { Customer, Settings, Task, Upgrade, EnvKey } from '@/lib/model/types'
import { formatDay, zoneAbbr, zonedToInstant } from '@/lib/dates'
import { firstStatusOf, statusCategory } from '@/lib/template/schedule'
import { windowPosition, windowTimeRange } from '@/lib/timeline'
import { windowByKey, windowName } from '@/lib/upgrade/logic'
import type { AgendaKind } from '@/lib/agenda'
import { updateTask, updateWindowByKey } from '@/store/upgradeActions'
import { phaseTone } from '@/theme/brand'
import { QuickToggle } from '@/components/ui/QuickToggle'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tooltip } from '@/components/ui/Tooltip'
import { CustomerChip } from '@/components/ui/misc'
import { cn } from '@/components/ui/cn'

const KIND_LABEL: Partial<Record<AgendaKind, string>> = { start: 'Starts', due: 'Due' }
const ENV_TONE: Record<EnvKey, string> = {
  dev: phaseTone.DEV,
  uat: phaseTone.UAT,
  prod: phaseTone.PROD,
}

/** Toggle a task between done and its "not started" status. */
export function toggleTask(upgradeId: string, t: Task, done: boolean, settings: Settings) {
  const target = done
    ? firstStatusOf(settings.taskStatuses, 'done')
    : firstStatusOf(settings.taskStatuses, 'planned')
  if (target) updateTask(upgradeId, t.id, { status: target.id })
}

export const AgendaRow = memo(function AgendaRow({
  kind,
  upgrade,
  customer,
  task,
  windowKey,
  settings,
  late,
}: {
  kind: AgendaKind | 'overdue' | 'blocked'
  upgrade: Upgrade
  customer: Customer | undefined
  task?: Task
  /** set for windows: "dev" | "uat" | "prod" | "x:<id>" */
  windowKey?: string
  settings: Settings
  late?: number
}) {
  const w = windowKey ? windowByKey(upgrade, windowKey) : null
  if (windowKey && w) {
    const name = windowName(upgrade, windowKey, customer)
    const cat = statusCategory(settings.windowStatuses, w.status)
    const pos = windowPosition(w, settings.displayTimeZone)
    let instant: Date | null
    try {
      instant = zonedToInstant(w.start, w.timeZone)
    } catch {
      instant = null
    }
    const done = cat === 'done'
    const tone = ENV_TONE[windowKey as EnvKey] ?? 'slate'
    return (
      <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5">
        <span className="absolute top-0 bottom-0 left-0 w-1 bg-accent" aria-hidden />
        <QuickToggle
          done={done}
          label={`Mark ${name} window ${done ? 'not done' : 'done'}`}
          onChange={(d) => {
            const s = d
              ? firstStatusOf(settings.windowStatuses, 'done')
              : (firstStatusOf(settings.windowStatuses, 'confirmed') ??
                firstStatusOf(settings.windowStatuses, 'planned'))
            if (s) updateWindowByKey(upgrade.id, windowKey, { status: s.id })
          }}
        />
        <Diamond
          className="h-4 w-4 shrink-0 fill-current"
          style={{ color: `var(--tone-${tone}-solid)` }}
          aria-hidden
        />
        <Link to={`/upgrades/${upgrade.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-semibold">
              {name} window → {upgrade.family}
            </span>
            <CustomerChip
              logo={customer?.logo}
              color={customer?.color ?? '#999'}
              label={customer?.name ?? 'Unknown'}
              className="text-xs text-muted"
            />
          </div>
          <Tooltip
            content={`Original: ${formatDay(w.start.slice(0, 10))} ${windowTimeRange(w)} ${instant ? zoneAbbr(w.timeZone, instant) : ''} (${w.timeZone})`}
          >
            <div className="text-xs text-muted tabular">
              <b className="text-text">{pos.local.slice(11)}</b>{' '}
              {instant ? zoneAbbr(settings.displayTimeZone, instant) : ''} · {w.durationHours} h ·
              original {w.start.slice(11)} {instant ? zoneAbbr(w.timeZone, instant) : w.timeZone}
            </div>
          </Tooltip>
        </Link>
        <StatusBadge status={settings.windowStatuses.find((s) => s.id === w.status)} size="sm" />
      </div>
    )
  }

  if (!task) return null
  const cat = statusCategory(settings.taskStatuses, task.status)
  const done = cat === 'done'
  const isCall = kind === 'call'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors hover:border-border-strong',
        kind === 'blocked'
          ? 'bg-problem-stripes border-danger/50'
          : kind === 'overdue'
            ? 'border-danger/40 bg-surface'
            : 'border-border bg-surface',
        isCall && 'border-warning/50',
      )}
    >
      <QuickToggle
        done={done}
        disabled={cat === 'na'}
        label={`Mark "${task.name}" ${done ? 'not done' : 'done'}`}
        onChange={(d) => toggleTask(upgrade.id, task, d, settings)}
      />
      {isCall && <Phone className="h-4 w-4 shrink-0 text-warning" aria-label="Call" />}
      <Link to={`/upgrades/${upgrade.id}?task=${task.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {KIND_LABEL[kind as AgendaKind] && (
            <span className="rounded bg-surface-3 px-1.5 text-[0.65rem] font-semibold tracking-wide text-muted uppercase">
              {KIND_LABEL[kind as AgendaKind]}
            </span>
          )}
          <span className={cn('truncate text-sm font-medium', done && 'text-subtle line-through')}>
            {task.name}
          </span>
          {task.time && <span className="text-xs text-muted tabular">{task.time.start}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-subtle">
          <CustomerChip
            logo={customer?.logo}
            color={customer?.color ?? '#999'}
            label={customer?.name ?? 'Unknown'}
          />
          <span>·</span>
          <span>{[task.assignedTo, task.owner, task.assignee].filter(Boolean).join(' / ')}</span>
          {late != null && late > 0 && (
            <span className="font-semibold text-danger">
              · {late} day{late === 1 ? '' : 's'} late (due {formatDay(task.end, 'EEE d MMM')})
            </span>
          )}
        </div>
      </Link>
      <StatusBadge status={settings.taskStatuses.find((s) => s.id === task.status)} size="sm" />
    </div>
  )
})
