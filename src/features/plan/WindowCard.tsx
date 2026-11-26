import { motion } from 'motion/react'
import { useState } from 'react'
import { CalendarPlus, Clock, Server, Trash2, X } from 'lucide-react'
import type { GoNoGo, GoNoGoDecision, Settings, UpgradeWindow } from '@/lib/model/types'
import { convertLocal, formatDay, formatInZone, zoneAbbr, zonedToInstant } from '@/lib/dates'
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

const GO_OPTIONS: { value: GoNoGoDecision; label: string; on: string }[] = [
  { value: 'pending', label: 'Pending', on: 'bg-surface-3 text-text' },
  { value: 'go', label: 'Go', on: 'bg-success text-white' },
  { value: 'nogo', label: 'No-Go', on: 'bg-danger text-white' },
]

export const GO_TEXT: Record<GoNoGoDecision, string> = {
  pending: 'Pending',
  go: 'Go',
  nogo: 'No-Go',
}

/** Go / No-Go decision of a window: Pending, Go or No-Go, with the day and who decided. */
function GoNoGoRow({
  value,
  label,
  people,
  onChange,
}: {
  value: GoNoGo
  label: string
  people: string[]
  onChange: (v: GoNoGo) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
      <span className="text-[0.7rem] font-medium text-muted">Go / No-Go</span>
      <div
        className="flex overflow-hidden rounded-md border border-border"
        role="radiogroup"
        aria-label={`${label} Go / No-Go`}
      >
        {GO_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value.decision === o.value}
            onClick={() =>
              o.value !== value.decision &&
              onChange({
                ...value,
                decision: o.value,
                date:
                  o.value === 'pending'
                    ? null
                    : (value.date ?? new Date().toISOString().slice(0, 10)),
              })
            }
            className={cn(
              'cursor-pointer px-2 py-0.5 text-[0.7rem] font-semibold transition-colors',
              value.decision === o.value ? o.on : 'text-subtle hover:bg-surface-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.decision !== 'pending' && (
        <>
          <input
            type="date"
            value={value.date ?? ''}
            aria-label={`${label} Go / No-Go date`}
            onChange={(e) =>
              /^d{4}-d{2}-d{2}$/.test(e.target.value) &&
              onChange({ ...value, date: e.target.value })
            }
            className={cn(fieldCls, 'h-7 w-[8.2rem] text-[0.72rem]')}
          />
          <input
            key={value.by}
            defaultValue={value.by}
            list="ut-people"
            placeholder="Decided by"
            aria-label={`${label} Go / No-Go decided by`}
            onBlur={(e) =>
              e.target.value.trim() !== value.by &&
              onChange({ ...value, by: e.target.value.trim() })
            }
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={cn(fieldCls, 'h-7 w-28 min-w-0 flex-1 text-[0.72rem]')}
          />
          <datalist id="ut-people">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}

export function WindowCard({
  label,
  window: w,
  settings,
  onChange,
  onRemove,
  onAdd,
  onRename,
  onDelete,
  instanceUrl,
  readOnly,
}: {
  /** the customer's name for the environment, or the extra window's name */
  label: string
  window: UpgradeWindow | null
  settings: Settings
  onChange: (patch: Partial<Omit<UpgradeWindow, 'updatedAt'>>) => void
  onRemove?: () => void
  onAdd?: () => void
  /** extra windows: rename */
  onRename?: (name: string) => void
  /** extra windows: delete */
  onDelete?: () => void
  instanceUrl?: string
  readOnly?: boolean
}) {
  const [time, setTime] = useState<string | null>(null)

  if (!w) {
    return (
      <div className="bg-pattern-dots flex min-h-28 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-center">
        <div className="eyebrow">{label} window</div>
        <div className="text-sm font-semibold text-muted">N/A</div>
        <p className="text-xs text-subtle">This customer skips {label}; its steps are N/A.</p>
        {onAdd && !readOnly && (
          <Button size="sm" onClick={onAdd}>
            <CalendarPlus className="h-3.5 w-3.5" /> Add {label} window
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
          {onRename ? (
            <input
              key={label}
              defaultValue={label}
              aria-label="Window name"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== label) onRename(v)
                else e.target.value = label
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="eyebrow w-28 rounded border border-transparent bg-transparent !text-text hover:border-border focus:border-accent focus:outline-none"
            />
          ) : (
            <span className="eyebrow !text-text">{label}</span>
          )}
          {instanceUrl && (
            <Tooltip content={`Open ${instanceUrl}`}>
              <a
                href={instanceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-subtle hover:text-accent-text"
                aria-label={`Open ${label} instance`}
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
            ariaLabel={`${label} window status`}
          />
          {onDelete && !readOnly && (
            <Tooltip content={`Remove the ${label} window`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                aria-label={`Remove the ${label} window`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {onRemove && !readOnly && (
            <Tooltip content={`No ${label} for this upgrade (N/A)`}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                aria-label={`Set ${label} to N/A`}
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
          aria-label={`${label} date`}
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
          aria-label={`${label} start time`}
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
              aria-label={`${label} duration in hours`}
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
        ariaLabel={`${label} time zone`}
      />
      <Tooltip content={`Original: ${disp.original}`}>
        <div className="truncate text-xs text-muted tabular">
          {disp.same ? 'Your time:' : 'Your time (converted):'}{' '}
          <span className="font-medium text-text">{disp.local}</span>
        </div>
      </Tooltip>
      <GoNoGoRow
        value={w.goNoGo}
        label={label}
        people={settings.people}
        onChange={(goNoGo) => onChange({ goNoGo })}
      />
    </motion.div>
  )
}
