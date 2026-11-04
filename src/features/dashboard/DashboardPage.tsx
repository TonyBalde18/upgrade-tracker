import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { RedFlow } from '@/components/ui/RedFlow'
import { Card, CustomerChip } from '@/components/ui/misc'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { progressOf } from '@/lib/template/schedule'
import { formatDay } from '@/lib/dates'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const card = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
}

/** Phase 1 preview of the dashboard. The full version (countdown, flow bars, heat strip) comes in phase 5. */
export function DashboardPage() {
  const doc = useTracker((s) => s.doc)
  const hydrated = useTracker((s) => s.hydrated)
  const { settings, customers, upgrades } = doc
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
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
      <section className="relative isolate overflow-hidden border-b border-border px-8 pt-10 pb-8">
        <div className="bg-pattern-grid absolute inset-0 -z-20" />
        <RedFlow className="-z-10" />
        <div className="eyebrow mb-2 text-accent-text">Overview</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Upgrades at a glance</h1>
        <div className="mt-6 flex flex-wrap gap-3">
          {counts.map(({ status, count }) => (
            <div
              key={status.id}
              className="flex min-w-36 flex-col gap-2 rounded-xl border border-border bg-surface/80 px-4 py-3 backdrop-blur"
            >
              <AnimatedNumber value={count} className="font-heading text-2xl font-bold tabular" />
              <StatusBadge status={status} size="sm" />
            </div>
          ))}
        </div>
      </section>

      <section className="px-8">
        {upgrades.length === 0 ? (
          <p className="text-sm text-muted">
            {customers.length} customer(s), no upgrades yet. Create the first one with “New
            upgrade”.
          </p>
        ) : (
          <motion.div
            variants={list}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {upgrades.map((u) => {
              const c = customerById.get(u.customerId)
              const pct = Math.round(progressOf(u.tasks, settings.taskStatuses) * 100)
              return (
                <motion.div key={u.id} variants={card} whileHover={{ y: -3 }}>
                  <Link to={`/upgrades/${u.id}`}>
                    <Card className="flex flex-col gap-3 p-5 transition-shadow hover:shadow-lift">
                      <div className="flex items-center justify-between gap-2">
                        <CustomerChip
                          color={c?.color ?? '#999'}
                          label={c?.name ?? 'Unknown'}
                          className="font-semibold"
                        />
                        <StatusBadge
                          status={settings.scheduleStatuses.find((s) => s.id === u.scheduleStatus)}
                          size="sm"
                        />
                      </div>
                      <div className="text-sm text-muted">
                        {u.fromFamily} <ArrowRight className="inline h-3.5 w-3.5" /> {u.family} ·{' '}
                        {u.cycle}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <motion.div
                          className="h-full origin-left rounded-full bg-accent"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: pct / 100 }}
                          transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-subtle">
                        <span>PROD {formatDay(u.windows.prod.start.slice(0, 10))}</span>
                        <span className="tabular">{pct}% complete</span>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </section>
    </div>
  )
}
