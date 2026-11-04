import { motion } from 'motion/react'
import { useState } from 'react'
import { CalendarPlus, Clock, Server, X } from 'lucide-react'
import type { EnvKey, Settings, UpgradeWindow } from '@/lib/model/types'
import { convertLocal, formatDay, formatInZone, zoneAbbr, zonedToInstant } from '@/lib/dates'
import { ENV_LABEL } from '@/lib/upgrade/logic'
import { Tooltip } from '@/components/ui/Tooltip'
import { TimeZoneSelect } from '@/components/ui/TimeZoneSelect'
import { Button } from '@/components/ui/Button'
import { StatusCell } from './cells'
import { cn } from '@/components/ui/cn'

const fieldCls =
  'h-8 rounded-md border border-border bg-surface px-2 text-[0.8rem] tabular hover:border-border-strong focus:border-accent focus:outline-none'

/** "Mon 23 Nov 2026 23:15 WET" in the display zone, plus the original zone. */
export function windowDisplay(w: UpgradeWindow, displayTz: string) {
  let instant: Date
  try {
    instant = zonedToInstant(w.start, w.timeZone)
  } catch {
    return {
      local: `${formatDay(w.start.slice(0, 10))} ${w.start.slice(11)}`,
      original: w.timeZone,
      same: true,
    }
  }
  const same =
    convertLocal(w.start, w.timeZone, displayTz) === w.start &&
    zoneAbbr(displayTz, instant) === zoneAbbr(w.timeZone, instant)
  return {
    local: `${formatInZone(instant, displayTz, 'EEE d MMM yyyy HH:mm')} ${zoneAbbr(displayTz, instant)}`,
    original: `${formatDay(w.start.slice(0, 10))} ${w.start.slice(11)} ${zoneAbbr(w.timeZone, instant)} (${w.timeZone})`,
    same,
  }
}

export function WindowCard({
  env,
  window: w,
  settings,
  onChange,
  onRemove,
  onAdd,
  instanceUrl,
}: {
  env: EnvKey
  window: UpgradeWindow | null
  settings: Settings
  onChange: (patch: Partial<Omit<UpgradeWindow, 'updatedAt'>>) => void
  onRemove?: () => void
  onAdd?: () => void
  instanceUrl?: string
}) {
  const [time, setTime] = useState<string | null>(null)

  if (!w) {
    return (
      <div className="bg-pattern-dots flex min-h-28 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-center">
        <div className="eyebrow">{ENV_LABEL[env]} window</div>
        <div className="text-sm font-semibold text-muted">N/A</div>
        <p className="text-xs text-subtle">
          This customer skips {ENV_LABEL[env]}; its steps are N/A.
        </p>
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            <CalendarPlus className="h-3.5 w-3.5" /> Add {ENV_LABEL[env]} window
          </Button>
        )}
      </div>
    )
  }

  const disp = windowDisplay(w, settings.displayTimeZone)
  const date = w.start.slice(0, 10)
  const hhmm = w.start.slice(11, 16)

  return (
    <motion.div
      layout
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-card',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow !text-text">{ENV_LABEL[env]}</span>
          {instanceUrl && (
            <Tooltip content={`Open ${instanceUrl}`}>
              <a
                href={instanceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-subtle hover:text-accent-text"
                aria-label={`Open ${ENV_LABEL[env]} instance`}
              >
                <Server className="h-3.5 w-3.5" />
              </a>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1">
          <StatusCell
            value={w.status}
            statuses={settings.windowStatuses}
            onCommit={(status) => onChange({ status })}
            ariaLabel={`${ENV_LABEL[env]} window status`}
          />
          {onRemove && (
            <Tooltip content={`No ${ENV_LABEL[env]} for this upgrade (N/A)`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                aria-label={`Set ${ENV_LABEL[env]} to N/A`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          aria-label={`${ENV_LABEL[env]} date`}
          value={date}
          onChange={(e) => {
            const v = e.target.value
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 && v !== date)
              onChange({ start: `${v}T${hhmm}` })
          }}
          className={cn(fieldCls, 'w-[8.6rem]')}
        />
        <input
          type="time"
          aria-label={`${ENV_LABEL[env]} start time`}
          value={time ?? hhmm}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => {
            if (time && time !== hhmm) onChange({ start: `${date}T${time}` })
            setTime(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={cn(fieldCls, 'w-[5.4rem]')}
        />
        <Tooltip content="Duration in hours">
          <label className={cn(fieldCls, 'flex w-[4.6rem] items-center gap-1')}>
            <Clock className="h-3 w-3 shrink-0 text-subtle" />
            <input
              type="number"
              min={0.5}
              step={0.5}
              aria-label={`${ENV_LABEL[env]} duration in hours`}
              value={w.durationHours}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v > 0 && v !== w.durationHours) onChange({ durationHours: v })
              }}
              className="w-full bg-transparent outline-none"
            />
          </label>
        </Tooltip>
      </div>
      <TimeZoneSelect
        value={w.timeZone}
        onChange={(tz) => onChange({ timeZone: tz })}
        className="h-8 text-[0.8rem]"
        ariaLabel={`${ENV_LABEL[env]} time zone`}
      />
      <Tooltip content={`Original: ${disp.original}`}>
        <div className="truncate text-xs text-muted tabular">
          {disp.same ? 'Your time:' : 'Your time (converted):'}{' '}
          <span className="font-medium text-text">{disp.local}</span>
        </div>
      </Tooltip>
    </motion.div>
  )
}
