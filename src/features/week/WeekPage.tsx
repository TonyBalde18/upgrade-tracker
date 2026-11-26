import { motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AlarmClock, CalendarCheck2, CalendarPlus, ChevronDown, OctagonAlert } from 'lucide-react'
import { useCustomerFilter, useUi } from '@/store/ui'
import { CustomerFilter } from '@/components/ui/CustomerFilter'
import { Button } from '@/components/ui/Button'
import { useTracker } from '@/store/tracker'
import { addDaysIso, diffDaysIso, formatDay, todayIn } from '@/lib/dates'
import { agenda, blockedTasks, groupByDay, overdueTasks, type AgendaItem } from '@/lib/agenda'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/components/ui/cn'
import { AgendaRow } from './AgendaRow'
import { useNow } from '@/lib/useNow'

type Span = '7' | '14' | '30'

type Row = { type: 'day'; date: string; count: number } | { type: 'item'; item: AgendaItem }

function dayLabel(date: string, today: string): string {
  const d = diffDaysIso(date, today)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return ''
}

function Section({
  icon,
  title,
  count,
  tone,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  tone: 'danger' | 'muted'
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-2xl border bg-surface',
        count && tone === 'danger' ? 'border-danger/40' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 px-4 py-3 text-left"
      >
        <span className={cn(count ? 'text-danger' : 'text-subtle')}>{icon}</span>
        <span className="font-heading font-semibold">{title}</span>
        <span
          className={cn(
            'rounded-full px-2 text-xs font-bold tabular',
            count ? 'bg-danger text-white' : 'bg-surface-3 text-subtle',
          )}
        >
          {count}
        </span>
        <motion.span className="ml-auto" animate={{ rotate: open ? 0 : -90 }}>
          <ChevronDown className="h-4 w-4 text-subtle" />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
      >
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto px-3 pb-3">{children}</div>
      </motion.div>
    </div>
  )
}

export default function WeekPage() {
  const doc = useTracker((s) => s.doc)
  const { settings, customers } = doc
  const now = useNow(60_000)
  const today = todayIn(settings.displayTimeZone, now)
  const [span, setSpan] = useState<Span>('7')
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const customerIds = useMemo(() => customers.map((c) => c.id), [customers])
  const picked = useCustomerFilter(customerIds)

  const filterDoc = useMemo(
    () =>
      picked ? { ...doc, upgrades: doc.upgrades.filter((u) => picked.has(u.customerId)) } : doc,
    [doc, picked],
  )
  const overdue = useMemo(() => overdueTasks(filterDoc, today), [filterDoc, today])
  const blocked = useMemo(() => blockedTasks(filterDoc), [filterDoc])
  const items = useMemo(
    () => agenda(filterDoc, today, addDaysIso(today, Number(span) - 1)),
    [filterDoc, today, span],
  )
  const rows = useMemo<Row[]>(
    () =>
      groupByDay(items).flatMap((g) => [
        { type: 'day' as const, date: g.date, count: g.items.length },
        ...g.items.map((item) => ({ type: 'item' as const, item })),
      ]),
    [items],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.type === 'day' ? 52 : 68),
    overscan: 8,
    getItemKey: (i) => {
      const r = rows[i]
      return r ? (r.type === 'day' ? `d:${r.date}` : r.item.key) : i
    },
  })

  const windows = items.filter((i) => i.kind === 'window').length
  const calls = items.filter((i) => i.kind === 'call').length

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-3 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <div className="eyebrow">Upcoming</div>
          <h1 className="text-2xl font-bold">My week</h1>
          <p className="text-xs text-muted">
            {items.length} item{items.length === 1 ? '' : 's'} · {windows} window
            {windows === 1 ? '' : 's'} · {calls} call{calls === 1 ? '' : 's'} in the next {span}{' '}
            days
          </p>
        </div>
        <CustomerFilter />
        <Button size="sm" onClick={() => useUi.getState().setIcsTarget({ kind: 'upcoming' })}>
          <CalendarPlus className="h-3.5 w-3.5" /> Export upcoming
        </Button>
        <Segmented<Span>
          ariaLabel="Period"
          value={span}
          onChange={setSpan}
          options={[
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ]}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          icon={<AlarmClock className="h-4 w-4" />}
          title="Overdue"
          count={overdue.length}
          tone="danger"
        >
          {overdue.length === 0 && (
            <p className="px-1 pb-1 text-sm text-subtle">Nothing overdue. Nice.</p>
          )}
          {overdue.map((o) => (
            <AgendaRow
              key={o.task.id}
              kind="overdue"
              upgrade={o.upgrade}
              task={o.task}
              customer={customerById.get(o.upgrade.customerId)}
              settings={settings}
              late={o.daysLate}
            />
          ))}
        </Section>
        <Section
          icon={<OctagonAlert className="h-4 w-4" />}
          title="Blocked"
          count={blocked.length}
          tone="danger"
        >
          {blocked.length === 0 && (
            <p className="px-1 pb-1 text-sm text-subtle">Nothing blocked.</p>
          )}
          {blocked.map((b) => (
            <AgendaRow
              key={b.task.id}
              kind="blocked"
              upgrade={b.upgrade}
              task={b.task}
              customer={customerById.get(b.upgrade.customerId)}
              settings={settings}
            />
          ))}
        </Section>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 />}
          title={`Nothing planned in the next ${span} days`}
          body="Try a longer period, or enjoy the quiet."
          className="min-h-60 flex-1"
        />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Agenda">
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
              const row = rows[v.index]!
              return (
                <div
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  {row.type === 'day' ? (
                    <div className="flex items-baseline gap-3 pt-4 pb-2">
                      <h2
                        className={cn(
                          'font-heading text-base font-bold',
                          row.date === today && 'text-accent-text',
                        )}
                      >
                        {formatDay(row.date)}
                      </h2>
                      {dayLabel(row.date, today) && (
                        <span className="eyebrow !text-accent-text">
                          {dayLabel(row.date, today)}
                        </span>
                      )}
                      <span className="text-xs text-subtle">
                        {row.count} item{row.count === 1 ? '' : 's'}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pb-2"
                    >
                      <AgendaRow
                        kind={row.item.kind}
                        upgrade={row.item.upgrade}
                        task={row.item.task}
                        windowKey={row.item.windowKey}
                        customer={customerById.get(row.item.upgrade.customerId)}
                        settings={settings}
                      />
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
