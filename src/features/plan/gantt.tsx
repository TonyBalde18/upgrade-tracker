/**
 * Day-by-day mini Gantt used next to the task table and in the template preview.
 * Each row draws its own track so it always lines up with its table row.
 */
import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { addDaysIso, diffDaysIso, formatDay, isoWeekOf, parseDay, todayIn } from '@/lib/dates'
import { format } from 'date-fns'
import type { Phase, StatusCategory } from '@/lib/model/types'
import { phaseTone } from '@/theme/brand'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'

export interface DayRange {
  start: string // a Monday
  days: number
}

/** Range covering all dates, padded and snapped to whole ISO weeks (Mon to Sun). */
export function computeRange(dates: (string | null | undefined)[], today?: string): DayRange {
  const valid = dates.filter((d): d is string => !!d).sort()
  const first = valid[0] ?? today ?? '2026-01-05'
  const last = valid[valid.length - 1] ?? first
  const start = isoWeekOf(addDaysIso(first, -2)).monday
  const endMonday = isoWeekOf(addDaysIso(last, 2)).monday
  const days = diffDaysIso(endMonday, start) + 7
  return { start, days: Math.max(days, 14) }
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/** Weekend shading: a 7-day repeating gradient starting on Monday. */
export function weekendBackground(dayW: number): CSSProperties {
  return {
    backgroundImage: `linear-gradient(90deg, transparent 0 ${dayW * 5}px, var(--ut-pattern) ${dayW * 5}px ${dayW * 7}px)`,
    backgroundSize: `${dayW * 7}px 100%`,
  }
}

export function GanttHeader({
  range,
  dayW,
  today,
}: {
  range: DayRange
  dayW: number
  today: string
}) {
  const days = useMemo(
    () => Array.from({ length: range.days }, (_, i) => addDaysIso(range.start, i)),
    [range],
  )
  const months = useMemo(() => {
    const out: { key: string; label: string; from: number; span: number }[] = []
    days.forEach((d, i) => {
      const key = d.slice(0, 7)
      const last = out[out.length - 1]
      if (last && last.key === key) last.span++
      else out.push({ key, label: format(parseDay(d), 'MMM yyyy'), from: i, span: 1 })
    })
    return out
  }, [days])
  return (
    <div className="relative select-none" style={{ width: range.days * dayW }}>
      <div className="relative h-5 border-b border-border">
        {months.map((m) => (
          <div
            key={m.key}
            className="eyebrow absolute top-0 flex h-5 items-center truncate border-l border-border px-1.5 !text-[0.6rem]"
            style={{ left: m.from * dayW, width: m.span * dayW }}
          >
            {m.span * dayW > 50 ? m.label : ''}
          </div>
        ))}
      </div>
      <div className="flex h-7" style={weekendBackground(dayW)}>
        {days.map((d, i) => {
          const isToday = d === today
          const wd = i % 7
          return (
            <div
              key={d}
              className={cn(
                'flex shrink-0 flex-col items-center justify-center text-[0.6rem] leading-tight tabular',
                wd === 0 && 'border-l border-border',
                isToday ? 'font-bold text-accent-text' : wd >= 5 ? 'text-subtle' : 'text-muted',
              )}
              style={{ width: dayW }}
              title={formatDay(d)}
            >
              {dayW >= 16 && <span>{'MTWTFSS'[wd]}</span>}
              {(dayW >= 16 || wd === 0) && <span>{d.slice(8)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface BarSpec {
  start: string | null
  end: string | null
  phase: Phase
  milestone: boolean
  category: StatusCategory | undefined
  label: string
  detail?: string
}

/** One row's track: weekend shading, today line and the bar / diamond. */
export function GanttTrack({
  range,
  dayW,
  today,
  bar,
  height = 44,
}: {
  range: DayRange
  dayW: number
  today: string
  bar: BarSpec | null
  height?: number
}) {
  const todayIdx = diffDaysIso(today, range.start)
  const tone = bar ? phaseTone[bar.phase] : 'slate'
  const startIdx = bar?.start ? diffDaysIso(bar.start, range.start) : null
  const len = bar?.start && bar.end ? Math.max(1, diffDaysIso(bar.end, bar.start) + 1) : 1
  const done = bar?.category === 'done'
  const blocked = bar?.category === 'blocked'
  const active = bar?.category === 'active'
  const na = bar?.category === 'na' || bar?.category === 'cancelled'

  return (
    <div
      className="relative"
      style={{ width: range.days * dayW, height, ...weekendBackground(dayW) }}
    >
      {todayIdx >= 0 && todayIdx < range.days && (
        <div
          className="absolute top-0 bottom-0 w-px bg-accent/70"
          style={{ left: todayIdx * dayW + dayW / 2 }}
          aria-hidden
        />
      )}
      {bar && startIdx != null && (
        <Tooltip
          content={
            <span>
              <b>{bar.label}</b>
              <br />
              {bar.start === bar.end || !bar.end
                ? formatDay(bar.start)
                : `${formatDay(bar.start)} to ${formatDay(bar.end)}`}
              {bar.detail ? (
                <>
                  <br />
                  {bar.detail}
                </>
              ) : null}
            </span>
          }
        >
          {bar.milestone ? (
            <motion.div
              className="absolute top-1/2"
              initial={false}
              animate={{ x: startIdx * dayW + dayW / 2 - 7, opacity: na ? 0.35 : 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{ marginTop: -7, left: 0 }}
            >
              <div
                className={cn(
                  'h-3.5 w-3.5 rotate-45 rounded-[2px] border-2',
                  active && 'shadow-glow',
                  blocked && 'bg-problem-stripes',
                )}
                style={{
                  borderColor: blocked ? 'var(--ut-danger)' : `var(--tone-${tone}-solid)`,
                  backgroundColor: done
                    ? `var(--tone-${tone}-solid)`
                    : blocked
                      ? undefined
                      : 'var(--ut-surface)',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              className={cn(
                'absolute top-1/2 h-4 rounded-full',
                active && 'ring-2 ring-accent',
                blocked && 'bg-problem-stripes ring-2 ring-danger',
              )}
              initial={false}
              animate={{
                x: startIdx * dayW + 2,
                width: Math.max(6, len * dayW - 4),
                opacity: na ? 0.3 : done ? 0.55 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              style={{
                marginTop: -8,
                left: 0,
                backgroundColor: blocked ? undefined : `var(--tone-${tone}-solid)`,
              }}
            />
          )}
        </Tooltip>
      )}
    </div>
  )
}

/** Today in the display time zone, refreshed every minute. */
export function useToday(tz: string): string {
  const [today, setToday] = useState(() => todayIn(tz))
  useEffect(() => {
    setToday(todayIn(tz))
    const id = setInterval(() => setToday(todayIn(tz)), 60_000)
    return () => clearInterval(id)
  }, [tz])
  return today
}
