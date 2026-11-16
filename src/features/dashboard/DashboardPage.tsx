import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { AlarmClock, ArrowRight, Diamond, OctagonAlert, Phone, Rocket, Timer } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { RedFlow } from '@/components/ui/RedFlow'
import { Card, CustomerChip } from '@/components/ui/misc'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { PhaseFlowBar } from '@/components/ui/PhaseFlowBar'
import { QuickToggle } from '@/components/ui/QuickToggle'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { progressOf } from '@/lib/template/schedule'
import {
  diffDaysIso,
  formatDay,
  formatInZone,
  todayIn,
  zoneAbbr,
  zonedToInstant,
} from '@/lib/dates'
import {
  activityHeat,
  blockedTasks,
  nextTasks,
  nextWindow,
  overdueTasks,
  upcomingGoNoGo,
} from '@/lib/agenda'
import { phaseFlow, windowPosition } from '@/lib/timeline'
import { ENV_LABEL, isActiveUpgrade } from '@/lib/upgrade/logic'
import { ENV_KEYS, type Customer, type Settings, type Upgrade } from '@/lib/model/types'
import { useNow } from '@/lib/useNow'
import { toggleTask } from '@/features/week/AgendaRow'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
}

// --- countdown -------------------------------------------------------------------

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0')
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-12 w-14 overflow-hidden rounded-xl border border-border bg-surface/80 backdrop-blur">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-extrabold tabular"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="eyebrow mt-1 !text-[0.58rem]">{label}</span>
    </div>
  )
}

function NextWindowCard({ settings }: { settings: Settings }) {
  const doc = useTracker((s) => s.doc)
  const now = useNow(1000)
  const next = useMemo(() => nextWindow(doc, now), [doc, now])
  const customer = next ? doc.customers.find((c) => c.id === next.upgrade.customerId) : undefined

  if (!next) {
    return (
      <div className="flex flex-col gap-2">
        <div className="eyebrow">Next upgrade window</div>
        <p className="text-sm text-muted">No upcoming windows. Plan one with “New upgrade”.</p>
      </div>
    )
  }
  const w = next.upgrade.windows[next.env]!
  const running = next.start <= now
  const ms = (running ? next.end : next.start).getTime() - now.getTime()
  const s = Math.max(0, Math.floor(ms / 1000))
  const parts = {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {running && <span className="pulse-dot h-2 w-2 rounded-full bg-accent text-accent" />}
        <span className={cn('eyebrow', running && '!text-accent-text')}>
          {running ? 'Window running now · ends in' : 'Next upgrade window in'}
        </span>
      </div>
      <div
        className="flex gap-2"
        role="timer"
        aria-label={`${parts.d} days ${parts.h} hours ${parts.m} minutes`}
      >
        <Unit value={parts.d} label="days" />
        <Unit value={parts.h} label="hours" />
        <Unit value={parts.m} label="min" />
        <Unit value={parts.s} label="sec" />
      </div>
      <Link to={`/upgrades/${next.upgrade.id}`} className="group flex flex-col gap-0.5">
        <span className="flex items-center gap-2 font-semibold group-hover:underline">
          <CustomerChip
            logo={customer?.logo}
            color={customer?.color ?? '#999'}
            label={customer?.name ?? 'Unknown'}
          />
          <span className="text-muted">·</span>
          {ENV_LABEL[next.env]} <ArrowRight className="h-3.5 w-3.5 text-accent-text" />{' '}
          {next.upgrade.family}
        </span>
        <Tooltip
          content={`Original: ${formatDay(w.start.slice(0, 10))} ${w.start.slice(11)} ${zoneAbbr(w.timeZone, next.start)} (${w.timeZone})`}
        >
          <span className="text-xs text-muted tabular">
            {formatInZone(next.start, settings.displayTimeZone, 'EEE d MMM yyyy HH:mm')}{' '}
            {zoneAbbr(settings.displayTimeZone, next.start)} · {w.durationHours} h
          </span>
        </Tooltip>
      </Link>
    </div>
  )
}

// --- tiles & heat strip --------------------------------------------------------------

function Tile({
  to,
  icon,
  label,
  value,
  danger,
  children,
}: {
  to: string
  icon: React.ReactNode
  label: string
  value: number
  danger?: boolean
  children?: React.ReactNode
}) {
  return (
    <motion.div variants={item} whileHover={{ y: -3 }}>
      <Link
        to={to}
        className={cn(
          'flex h-full flex-col gap-1 rounded-xl border bg-surface/80 p-3.5 backdrop-blur transition-shadow hover:shadow-lift',
          danger && value > 0 ? 'border-danger/50' : 'border-border',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 text-xs font-medium',
            danger && value > 0 ? 'text-danger' : 'text-muted',
          )}
        >
          {icon} {label}
        </div>
        <AnimatedNumber
          value={value}
          className={cn(
            'font-heading text-3xl font-extrabold tabular',
            danger && value > 0 && 'text-danger',
          )}
        />
        {children}
      </Link>
    </motion.div>
  )
}

function HeatStrip({ today }: { today: string }) {
  const doc = useTracker((s) => s.doc)
  const heat = useMemo(() => activityHeat(doc, today, 30), [doc, today])
  const customers = doc.customers
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Next 30 days</span>
        <span className="text-[0.65rem] text-subtle">◆ upgrade window · darker = busier</span>
      </div>
      <div className="flex gap-[3px]">
        {heat.map((d, i) => {
          const wd = new Date(`${d.date}T12:00:00`).getDay()
          return (
            <Tooltip
              key={d.date}
              content={
                <span className="flex flex-col">
                  <b>{formatDay(d.date)}</b>
                  <span>
                    {d.tasks} open task{d.tasks === 1 ? '' : 's'} running
                  </span>
                  {d.windows.map((w) => (
                    <span key={`${w.upgrade.id}${w.env}`}>
                      ◆ {customers.find((c) => c.id === w.upgrade.customerId)?.name}:{' '}
                      {ENV_LABEL[w.env]}
                    </span>
                  ))}
                </span>
              }
            >
              <motion.div
                initial={{ opacity: 0, scaleY: 0.3 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: i * 0.015, type: 'spring', stiffness: 300, damping: 24 }}
                className={cn(
                  'relative flex h-10 flex-1 origin-bottom items-center justify-center rounded-md border',
                  i === 0 ? 'border-accent' : 'border-transparent',
                  (wd === 0 || wd === 6) && 'bg-pattern-dots',
                )}
                style={{
                  backgroundColor:
                    d.level > 0
                      ? `rgba(225,41,44,${0.08 + d.level * 0.72})`
                      : 'var(--ut-surface-2)',
                }}
              >
                {d.windows.length > 0 && (
                  <Diamond className="h-3 w-3 fill-white text-white drop-shadow" aria-hidden />
                )}
              </motion.div>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex justify-between text-[0.6rem] text-subtle tabular">
        <span>Today</span>
        <span>{formatDay(heat[14]?.date, 'd MMM')}</span>
        <span>{formatDay(heat[29]?.date, 'd MMM')}</span>
      </div>
    </div>
  )
}

// --- upgrade card ----------------------------------------------------------------------

function UpgradeCard({
  upgrade,
  customer,
  settings,
  today,
}: {
  upgrade: Upgrade
  customer: Customer | undefined
  settings: Settings
  today: string
}) {
  const pct = progressOf(upgrade.tasks, settings.taskStatuses)
  const flow = phaseFlow(upgrade, settings)
  const next = nextTasks(upgrade, settings, 3)
  const nextWin = ENV_KEYS.map((env) => ({ env, w: upgrade.windows[env] }))
    .filter((x) => x.w && windowPosition(x.w, settings.displayTimeZone).date >= today)
    .sort((a, b) => a.w!.start.localeCompare(b.w!.start))[0]

  return (
    <motion.div
      variants={item}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <Card className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-lift">
        <div className="flex items-start gap-3">
          <ProgressRing value={pct} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/customers/${customer?.id ?? ''}`} className="min-w-0 hover:underline">
                <CustomerChip
                  logo={customer?.logo}
                  color={customer?.color ?? '#999'}
                  label={customer?.name ?? 'Unknown'}
                  className="font-semibold"
                />
              </Link>
              <StatusBadge
                status={settings.scheduleStatuses.find((s) => s.id === upgrade.scheduleStatus)}
                size="sm"
              />
            </div>
            <Link
              to={`/upgrades/${upgrade.id}`}
              className="mt-0.5 flex items-center gap-1.5 text-sm text-muted hover:text-text"
            >
              {upgrade.fromFamily} <ArrowRight className="h-3.5 w-3.5 text-accent-text" />{' '}
              <span className="font-medium text-text">{upgrade.family}</span>
              <span className="text-subtle">· {upgrade.cycle}</span>
            </Link>
          </div>
        </div>

        <PhaseFlowBar flow={flow} />

        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Next steps</span>
          {next.length === 0 && <span className="text-xs text-subtle">All steps done.</span>}
          <AnimatePresence initial={false}>
            {next.map((t) => {
              const late = t.end && t.end < today
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-2.5"
                >
                  <QuickToggle
                    size="sm"
                    done={false}
                    label={`Mark "${t.name}" done`}
                    onChange={(d) => toggleTask(upgrade.id, t, d, settings)}
                  />
                  <Link
                    to={`/upgrades/${upgrade.id}?task=${t.id}`}
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                    title={t.name}
                  >
                    {t.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-xs tabular',
                      late ? 'font-semibold text-danger' : 'text-subtle',
                    )}
                  >
                    {late ? `due ${formatDay(t.end, 'd MMM')}` : formatDay(t.start, 'EEE d MMM')}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {nextWin && nextWin.w && (
          <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Diamond className="h-3 w-3 fill-current text-accent-text" /> {ENV_LABEL[nextWin.env]}{' '}
              {formatDay(nextWin.w.start.slice(0, 10), 'EEE d MMM')} {nextWin.w.start.slice(11)}{' '}
              {(() => {
                try {
                  return zoneAbbr(
                    nextWin.w.timeZone,
                    zonedToInstant(nextWin.w.start, nextWin.w.timeZone),
                  )
                } catch {
                  return ''
                }
              })()}
            </span>
            <span className="tabular">
              {(() => {
                const d = diffDaysIso(
                  windowPosition(nextWin.w, settings.displayTimeZone).date,
                  today,
                )
                return d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
              })()}
            </span>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// --- page -------------------------------------------------------------------------------

export function DashboardPage() {
  const doc = useTracker((s) => s.doc)
  const hydrated = useTracker((s) => s.hydrated)
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const { settings, customers, upgrades } = doc
  const now = useNow(60_000)
  const today = todayIn(settings.displayTimeZone, now)
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const active = useMemo(
    () =>
      upgrades
        .filter((u) => isActiveUpgrade(u, settings))
        .sort((a, b) => a.windows.prod.start.localeCompare(b.windows.prod.start)),
    [upgrades, settings],
  )
  const overdue = useMemo(() => overdueTasks(doc, today), [doc, today])
  const blocked = useMemo(() => blockedTasks(doc), [doc])
  const calls = useMemo(() => upcomingGoNoGo(doc, today, 21), [doc, today])
  const counts = useMemo(
    () =>
      settings.scheduleStatuses.map((s) => ({
        status: s,
        count: upgrades.filter((u) => u.scheduleStatus === s.id).length,
      })),
    [settings.scheduleStatuses, upgrades],
  )

  if (hydrated && customers.length === 0 && upgrades.length === 0) return <Onboarding />

  return (
    <div className="flex flex-col gap-8 pb-10">
      <section className="relative isolate overflow-hidden border-b border-border px-8 pt-8 pb-7">
        <div className="bg-pattern-grid absolute inset-0 -z-20" />
        <RedFlow className="-z-10" />
        <motion.div variants={list} initial="hidden" animate="show" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <motion.div variants={item}>
              <NextWindowCard settings={settings} />
            </motion.div>
            <motion.div variants={list} className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile
                to="/timeline"
                icon={<Rocket className="h-3.5 w-3.5" />}
                label="Active upgrades"
                value={active.length}
              />
              <Tile
                to="/week"
                icon={<AlarmClock className="h-3.5 w-3.5" />}
                label="Overdue tasks"
                value={overdue.length}
                danger
              />
              <Tile
                to="/week"
                icon={<OctagonAlert className="h-3.5 w-3.5" />}
                label="Blocked"
                value={blocked.length}
                danger
              />
              <Tile
                to="/week"
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Go / No-Go (21 days)"
                value={calls.length}
              >
                {calls.slice(0, 2).map((c) => (
                  <span key={c.task.id} className="truncate text-[0.68rem] text-muted">
                    {formatDay(c.task.start, 'EEE d MMM')} ·{' '}
                    {customerById.get(c.upgrade.customerId)?.name}
                  </span>
                ))}
              </Tile>
            </motion.div>
          </div>
          <motion.div variants={item} className="flex flex-wrap gap-2">
            {counts.map(({ status, count }) => (
              <div
                key={status.id}
                className={cn(
                  'flex items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pr-1 pl-3 backdrop-blur',
                  count === 0 && 'opacity-50',
                )}
              >
                <AnimatedNumber value={count} className="font-heading text-sm font-bold tabular" />
                <StatusBadge status={status} size="sm" />
              </div>
            ))}
          </motion.div>
          <motion.div variants={item}>
            <HeatStrip today={today} />
          </motion.div>
        </motion.div>
      </section>

      <section className="px-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="eyebrow">In flight</div>
            <h2 className="text-xl font-bold">Active upgrades</h2>
          </div>
          <Link
            to="/canvas"
            className="flex items-center gap-1 text-sm text-muted hover:text-accent-text"
          >
            Open canvas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {active.length === 0 ? (
          <Card className="bg-pattern-grid flex flex-col items-center gap-3 p-10 text-center">
            <Timer className="h-6 w-6 text-accent-text" />
            <p className="text-sm text-muted">
              {customers.length} customer{customers.length === 1 ? '' : 's'}, no active upgrades.
              Create the first one.
            </p>
            <Button variant="primary" onClick={() => setNewUpgradeOpen(true)}>
              New upgrade
            </Button>
          </Card>
        ) : (
          <motion.div
            variants={list}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
          >
            {active.map((u) => (
              <UpgradeCard
                key={u.id}
                upgrade={u}
                customer={customerById.get(u.customerId)}
                settings={settings}
                today={today}
              />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  )
}
