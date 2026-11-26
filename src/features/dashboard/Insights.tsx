import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowRight, CircleAlert, Info, PartyPopper } from 'lucide-react'
import type { TrackerDoc } from '@/lib/model/types'
import {
  attentionItems,
  upgradesPerMonth,
  type AttentionItem,
  type AttentionLevel,
} from '@/lib/attention'
import { formatDay } from '@/lib/dates'
import { Card } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'

const LEVEL: Record<AttentionLevel, { label: string; icon: typeof AlertTriangle; cls: string }> = {
  high: { label: 'Urgent', icon: CircleAlert, cls: 'text-danger' },
  medium: { label: 'Soon', icon: AlertTriangle, cls: 'text-warning' },
  low: { label: 'Check', icon: Info, cls: 'text-subtle' },
}

/** Everything that needs a look: overdue / blocked steps, clashes, missing decisions... */
export function NeedsAttention({ doc, today }: { doc: TrackerDoc; today: string }) {
  const items = useMemo(() => attentionItems(doc, today), [doc, today])
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 6)
  const high = items.filter((i) => i.level === 'high').length

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="eyebrow">Today</div>
          <h2 className="text-lg font-bold">Needs attention</h2>
        </div>
        {items.length > 0 && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-bold tabular',
              high ? 'bg-danger text-white' : 'bg-surface-3 text-muted',
            )}
          >
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <PartyPopper className="h-4 w-4 text-success" /> Nothing needs attention right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((i) => (
            <AttentionRow key={i.key} item={i} />
          ))}
        </ul>
      )}
      {items.length > 6 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-fit cursor-pointer text-xs text-muted hover:text-text"
        >
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </Card>
  )
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const l = LEVEL[item.level]
  const Icon = l.icon
  return (
    <li>
      <Link
        to={item.to}
        className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2"
      >
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', l.cls)} aria-label={l.label} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug">{item.title}</span>
          {item.detail && <span className="block truncate text-xs text-subtle">{item.detail}</span>}
        </span>
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100" />
      </Link>
    </li>
  )
}

// --- charts ---------------------------------------------------------------------

const CHART_H = 132

/**
 * Upgrades per month by their PROD date, stacked by upgrade status (the status
 * colours of Settings). Hover a month for the numbers; a table is there for screen readers.
 */
export function UpgradesPerMonth({ doc, today }: { doc: TrackerDoc; today: string }) {
  const bars = useMemo(() => upgradesPerMonth(doc, today), [doc, today])
  const max = Math.max(1, ...bars.map((b) => b.total))
  const thisMonth = today.slice(0, 7)
  const used = doc.settings.scheduleStatuses.filter((s) =>
    bars.some((b) => b.counts.some((c) => c.status.id === s.id && c.count > 0)),
  )
  const ticks =
    max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.ceil(max / 2), max]

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div>
        <div className="eyebrow">By PROD date</div>
        <h2 className="text-lg font-bold">Upgrades per month</h2>
      </div>
      <div className="flex gap-2">
        {/* y axis */}
        <div
          className="relative w-4 shrink-0 text-[0.65rem] text-subtle tabular"
          style={{ height: CHART_H }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: CHART_H - (t / max) * CHART_H }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* recessive grid */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute right-0 left-0 border-t border-border/70"
              style={{ top: CHART_H - (t / max) * CHART_H }}
              aria-hidden
            />
          ))}
          <div className="relative flex items-end gap-1.5" style={{ height: CHART_H }}>
            {bars.map((b) => (
              <Tooltip
                key={b.month}
                content={
                  <span className="flex flex-col gap-0.5">
                    <b>{formatDay(`${b.month}-01`, 'MMMM yyyy')}</b>
                    {b.total === 0 && <span className="text-muted">No upgrades</span>}
                    {b.counts
                      .filter((c) => c.count > 0)
                      .map((c) => (
                        <span key={c.status.id} className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ backgroundColor: `var(--tone-${c.status.tone}-solid)` }}
                          />
                          {c.status.label}: <b className="tabular">{c.count}</b>
                        </span>
                      ))}
                  </span>
                }
              >
                {/* hit target is the whole column, bigger than the bar */}
                <div className="flex h-full min-w-0 flex-1 cursor-default flex-col justify-end">
                  <div className="flex flex-col-reverse gap-[2px]">
                    {b.counts
                      .filter((c) => c.count > 0)
                      .map((c, i, arr) => (
                        <div
                          key={c.status.id}
                          className={cn(i === arr.length - 1 && 'rounded-t-[4px]')}
                          style={{
                            height: Math.max(2, (c.count / max) * CHART_H - 2),
                            backgroundColor: `var(--tone-${c.status.tone}-solid)`,
                          }}
                        />
                      ))}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {bars.map((b) => (
              <span
                key={b.month}
                className={cn(
                  'min-w-0 flex-1 truncate text-center text-[0.62rem] tabular',
                  b.month === thisMonth ? 'font-bold text-text' : 'text-subtle',
                )}
              >
                {formatDay(`${b.month}-01`, 'MMM')}
              </span>
            ))}
          </div>
        </div>
      </div>
      {used.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {used.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: `var(--tone-${s.tone}-solid)` }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>Upgrades per month by status</caption>
        <thead>
          <tr>
            <th>Month</th>
            {used.map((s) => (
              <th key={s.id}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.month}>
              <td>{b.month}</td>
              {used.map((s) => (
                <td key={s.id}>{b.counts.find((c) => c.status.id === s.id)?.count ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/** All upgrades by status as one bar, with the count of each status. */
export function StatusBreakdown({ doc }: { doc: TrackerDoc }) {
  const counts = doc.settings.scheduleStatuses.map((s) => ({
    status: s,
    count: doc.upgrades.filter((u) => u.scheduleStatus === s.id).length,
  }))
  const total = counts.reduce((s, c) => s + c.count, 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">All upgrades by status</span>
        <span className="text-xs text-subtle tabular">{total} in total</span>
      </div>
      {total > 0 && (
        <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]" aria-hidden>
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <Tooltip key={c.status.id} content={`${c.status.label}: ${c.count}`}>
                <div
                  className="h-full"
                  style={{
                    flexGrow: c.count,
                    backgroundColor: `var(--tone-${c.status.tone}-solid)`,
                  }}
                />
              </Tooltip>
            ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {counts.map(({ status, count }) => (
          <span
            key={status.id}
            className={cn(
              'flex items-center gap-1.5 text-xs text-muted',
              count === 0 && 'opacity-50',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: `var(--tone-${status.tone}-solid)` }}
            />
            {status.label} <b className="text-text tabular">{count}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
