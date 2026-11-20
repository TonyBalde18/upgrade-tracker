import { ReleasePath } from '@/components/ui/Release'
import { memo, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDraggable } from '@dnd-kit/core'
import type { Customer, EnvKey, Settings, Upgrade } from '@/lib/model/types'
import { ENV_KEYS } from '@/lib/model/types'
import { addDaysIso, diffDaysIso, formatDay, zoneAbbr, zonedToInstant } from '@/lib/dates'
import { phaseSpans, windowPosition, windowState, windowTimeRange } from '@/lib/timeline'
import { ENV_LABEL } from '@/lib/upgrade/logic'
import { progressOf } from '@/lib/template/schedule'
import { phaseTone } from '@/theme/brand'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tooltip } from '@/components/ui/Tooltip'
import { CustomerAvatar } from '@/components/ui/misc'
import { cn } from '@/components/ui/cn'

export const LABEL_W = 320
export const ROW_H = 56

const ENV_TONE: Record<EnvKey, string> = {
  dev: phaseTone.DEV,
  uat: phaseTone.UAT,
  prod: phaseTone.PROD,
}

export interface DragPreview {
  markerId: string
  days: number
}

interface MarkerProps {
  upgrade: Upgrade
  env: EnvKey
  settings: Settings
  x: number
  px: number
  showLabel: boolean
  clash: boolean
  preview: DragPreview | null
}

function WindowMarker({ upgrade, env, settings, x, px, showLabel, clash, preview }: MarkerProps) {
  const w = upgrade.windows[env]!
  const id = `${upgrade.id}:${env}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { upgradeId: upgrade.id, env },
  })
  const cat = windowState(w, settings)
  const status = settings.windowStatuses.find((s) => s.id === w.status)
  const tone = ENV_TONE[env]
  const days = preview?.markerId === id ? preview.days : 0
  const style: CSSProperties = {
    left: x - 9,
    transform: days ? `translateX(${days * px}px)` : undefined,
  }

  let instant: Date | null
  try {
    instant = zonedToInstant(w.start, w.timeZone)
  } catch {
    instant = null
  }
  const pos = windowPosition(w, settings.displayTimeZone)

  const marker = (
    <button
      ref={setNodeRef}
      type="button"
      data-marker
      {...attributes}
      {...listeners}
      aria-label={`${ENV_LABEL[env]} window ${formatDay(w.start.slice(0, 10))} ${w.start.slice(11)}. Drag to reschedule.`}
      className={cn(
        'absolute top-[19px] z-10 flex h-[18px] w-[18px] cursor-grab items-center justify-center touch-none focus:outline-none active:cursor-grabbing',
        isDragging && 'z-30',
      )}
      style={style}
    >
      <span
        className={cn(
          'block h-3.5 w-3.5 rotate-45 rounded-[3px] border-2 transition-transform group-hover/row:scale-110',
          cat === 'active' && 'shadow-glow',
          clash && 'ring-2 ring-danger ring-offset-1 ring-offset-[var(--ut-surface)]',
          isDragging && 'scale-125 shadow-lift',
        )}
        style={{
          borderColor: `var(--tone-${tone}-solid)`,
          backgroundColor: cat === 'planned' ? 'var(--ut-surface)' : `var(--tone-${tone}-solid)`,
          opacity: cat === 'cancelled' ? 0.35 : 1,
        }}
      />
      {showLabel && (
        <span className="pointer-events-none absolute -top-[15px] left-1/2 -translate-x-1/2 text-[0.58rem] font-bold tracking-wider text-muted">
          {ENV_LABEL[env]}
        </span>
      )}
      {days !== 0 && (
        <span className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-md bg-accent px-1.5 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap text-accent-fg shadow-lift tabular">
          {days > 0 ? '+' : ''}
          {days}d · {formatDay(addDaysIso(w.start.slice(0, 10), days), 'EEE d MMM')}
        </span>
      )}
    </button>
  )
  if (isDragging) return marker
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
          <b>
            {ENV_LABEL[env]} window · {status?.label ?? 'Unknown'}
          </b>
          <span>
            {formatDay(w.start.slice(0, 10))} · {windowTimeRange(w)}{' '}
            {instant ? zoneAbbr(w.timeZone, instant) : ''} ({w.timeZone})
          </span>
          <span className="text-muted">
            Your time: {formatDay(pos.date)} {pos.local.slice(11)}{' '}
            {instant ? zoneAbbr(settings.displayTimeZone, instant) : ''}
          </span>
          {clash && (
            <span className="text-danger">Another customer goes live on PROD the same night.</span>
          )}
          <span className="text-subtle">Drag to reschedule</span>
        </div>
      }
    >
      {marker}
    </Tooltip>
  )
}

export const TimelineRow = memo(function TimelineRow({
  upgrade,
  customer,
  settings,
  rangeStart,
  px,
  width,
  firstOfGroup,
  clash,
  preview,
  suppressClick,
}: {
  upgrade: Upgrade
  customer: Customer | undefined
  settings: Settings
  rangeStart: string
  px: number
  width: number
  firstOfGroup: boolean
  clash: boolean
  preview: DragPreview | null
  suppressClick: () => boolean
}) {
  const navigate = useNavigate()
  const spans = phaseSpans(upgrade, settings)
  const pct = Math.round(progressOf(upgrade.tasks, settings.taskStatuses) * 100)
  const status = settings.scheduleStatuses.find((s) => s.id === upgrade.scheduleStatus)
  const xOf = (iso: string) => diffDaysIso(iso, rangeStart) * px
  const open = () => {
    if (!suppressClick()) navigate(`/upgrades/${upgrade.id}`)
  }

  return (
    <div
      className={cn(
        'group/row flex',
        firstOfGroup ? 'border-t border-border-strong' : 'border-t border-border/50',
      )}
      style={{ height: ROW_H }}
    >
      <Link
        to={`/upgrades/${upgrade.id}`}
        data-nopan
        className="sticky left-0 z-20 flex shrink-0 items-center gap-3 border-r border-border bg-surface px-3 transition-colors hover:bg-surface-2"
        style={{ width: LABEL_W }}
      >
        <CustomerAvatar
          name={customer?.name ?? 'Unknown'}
          shortName={customer?.shortName}
          color={customer?.color ?? '#999'}
          logo={customer?.logo}
          size={36}
          className={cn(!firstOfGroup && 'opacity-60')}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm', firstOfGroup ? 'font-semibold' : 'text-muted')}>
              {customer?.name ?? 'Unknown'}
            </span>
            <span className="shrink-0 text-xs text-subtle tabular">{pct}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
              <ReleasePath from={upgrade.fromFamily} to={upgrade.family} size={14} />
            </span>
            <StatusBadge status={status} size="sm" />
          </div>
        </div>
      </Link>
      <div className="relative" style={{ width }}>
        {spans.map((s) => {
          const tone = phaseTone[s.phase]
          const left = xOf(s.start)
          const w = Math.max(3, (diffDaysIso(s.end, s.start) + 1) * px)
          return (
            <Tooltip
              key={s.phase}
              content={
                <span>
                  <b>{s.phase}</b> · {s.done}/{s.total} done
                  <br />
                  {formatDay(s.start)} to {formatDay(s.end)}
                </span>
              }
            >
              <div
                role="button"
                tabIndex={-1}
                onClick={open}
                className={cn(
                  'absolute top-[24px] h-2.5 cursor-pointer rounded-full transition-opacity hover:opacity-100',
                  s.state === 'active' && 'ring-2 ring-accent',
                  s.state === 'blocked' && 'bg-problem-stripes ring-2 ring-danger',
                )}
                style={{
                  left,
                  width: w,
                  backgroundColor:
                    s.state === 'blocked'
                      ? undefined
                      : s.state === 'planned'
                        ? `var(--tone-${tone}-bg)`
                        : `var(--tone-${tone}-solid)`,
                  border: s.state === 'planned' ? `1px solid var(--tone-${tone}-solid)` : undefined,
                  opacity: s.state === 'done' ? 0.5 : 0.92,
                }}
              />
            </Tooltip>
          )
        })}
        {ENV_KEYS.map((env) => {
          const w = upgrade.windows[env]
          if (!w) return null
          const pos = windowPosition(w, settings.displayTimeZone)
          return (
            <WindowMarker
              key={env}
              upgrade={upgrade}
              env={env}
              settings={settings}
              x={xOf(pos.date) + pos.fraction * px}
              px={px}
              showLabel={px * 7 >= 56}
              clash={env === 'prod' && clash}
              preview={preview}
            />
          )
        })}
      </div>
    </div>
  )
})
