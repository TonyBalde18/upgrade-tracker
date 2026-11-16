import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Plus,
  Rocket,
  Search,
} from 'lucide-react'
import { useUi } from '@/store/ui'
import { useTracker } from '@/store/tracker'
import { createUpgrade } from '@/store/upgradeActions'
import type { EnvKey, Phase, UpgradeWindow } from '@/lib/model/types'
import { ENV_KEYS, PHASES } from '@/lib/model/types'
import { FAMILY_SUGGESTIONS } from '@/lib/model/defaults'
import { addDaysIso, formatDay, todayIn } from '@/lib/dates'
import {
  ENV_LABEL,
  activeUpgradeFor,
  cycleForDate,
  defaultWindows,
  makeWindow,
  windowWarnings,
} from '@/lib/upgrade/logic'
import { generateTasks, firstStatusOf } from '@/lib/template/schedule'
import { phaseTone } from '@/theme/brand'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { TimeZoneSelect } from '@/components/ui/TimeZoneSelect'
import { CustomerChip } from '@/components/ui/misc'
import { cn } from '@/components/ui/cn'

const STEPS = ['Customer', 'Releases', 'Windows', 'Preview'] as const
type Windows = { dev: UpgradeWindow; uat: UpgradeWindow | null; prod: UpgradeWindow }

const fieldCls =
  'h-9 rounded-lg border border-border bg-surface px-2.5 text-sm tabular hover:border-border-strong focus:border-accent focus:outline-none'

function Body() {
  const setOpen = useUi((s) => s.setNewUpgradeOpen)
  const preselected = useUi((s) => s.newUpgradeCustomerId)
  const navigate = useNavigate()
  const doc = useTracker((s) => s.doc)
  const addCustomers = useTracker((s) => s.addCustomers)
  const { settings, template, customers } = doc
  const today = todayIn(settings.displayTimeZone)

  const [step, setStep] = useState(preselected && !activeUpgradeFor(preselected, doc) ? 1 : 0)
  const [dir, setDir] = useState(1)
  const [customerId, setCustomerId] = useState<string | null>(preselected)
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')

  const lastFamilyOf = (id: string | null) =>
    id
      ? [...doc.upgrades]
          .filter((u) => u.customerId === id)
          .sort((a, b) => b.windows.prod.start.localeCompare(a.windows.prod.start))[0]?.family
      : undefined
  const [fromFamily, setFromFamily] = useState(() => lastFamilyOf(preselected) ?? 'Zurich')
  const [family, setFamily] = useState('Australia')
  const [windows, setWindows] = useState<Windows>(() => defaultWindows(today, settings))
  const [savedUat, setSavedUat] = useState<UpgradeWindow | null>(null)
  const [cycle, setCycle] = useState(() => cycleForDate(windows.prod.start.slice(0, 10)))
  const [cycleTouched, setCycleTouched] = useState(false)
  const [caseUrl, setCaseUrl] = useState('')

  const go = (n: number) => {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }

  const filtered = customers
    .filter((c) => c.active || c.id === customerId)
    .filter((c) => !query || `${c.name} ${c.shortName}`.toLowerCase().includes(query.toLowerCase()))
  const customer = customers.find((c) => c.id === customerId)
  const blocking = customerId ? activeUpgradeFor(customerId, doc) : undefined

  const setWin = (env: EnvKey, patch: Partial<UpgradeWindow>) => {
    if (env === 'prod' && patch.start && !cycleTouched)
      setCycle(cycleForDate(patch.start.slice(0, 10)))
    setWindows((w) => {
      const cur = w[env]
      return cur ? { ...w, [env]: { ...cur, ...patch } } : w
    })
  }
  const toggleUat = (on: boolean) => {
    setWindows((w) => {
      if (!on) {
        setSavedUat(w.uat)
        return { ...w, uat: null }
      }
      const planned = firstStatusOf(settings.windowStatuses, 'planned')?.id ?? 'ws-planned'
      return {
        ...w,
        uat:
          savedUat ??
          makeWindow(
            addDaysIso(w.dev.start.slice(0, 10), 7),
            w.dev.start.slice(11, 16),
            w.dev.timeZone,
            w.dev.durationHours,
            planned,
          ),
      }
    })
  }

  const preview = useMemo(
    () => generateTasks({ template, windows, family: family || '{family}', settings }),
    [template, windows, family, settings],
  )
  const firstDate = preview
    .map((t) => t.start)
    .filter((d): d is string => !!d)
    .sort()[0]
  const warnings = windowWarnings(windows)

  const canNext = [
    !!customerId && !blocking,
    family.trim().length > 0 && fromFamily.trim().length > 0 && cycle.trim().length > 0,
    warnings.length === 0,
    true,
  ][step]

  const create = () => {
    if (!customerId || blocking) return
    const id = createUpgrade({ customerId, family, fromFamily, cycle, snCaseUrl: caseUrl, windows })
    setOpen(false)
    navigate(`/upgrades/${id}`)
    toast.success('Upgrade created', {
      description: `${customer?.name ?? ''}: ${fromFamily} → ${family}, ${preview.length} steps.`,
    })
  }

  const quickAdd = () => {
    const name = newName.trim()
    if (!name) return
    addCustomers([name])
    const c = useTracker
      .getState()
      .doc.customers.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (c) setCustomerId(c.id)
    setNewName('')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* stepper */}
      <ol className="flex items-center gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={i > step}
              onClick={() => go(i)}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                i < step && 'bg-accent text-accent-fg cursor-pointer',
                i === step && 'bg-accent-soft text-accent-text ring-2 ring-accent',
                i > step && 'bg-surface-3 text-subtle',
              )}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s}`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span
              className={cn(
                'hidden text-xs font-medium sm:inline',
                i === step ? 'text-text' : 'text-subtle',
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="absolute inset-0 origin-left bg-accent"
                  initial={false}
                  animate={{ scaleX: i < step ? 1 : 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="relative min-h-[23rem] overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            {step === 0 && (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search customers…"
                    className="pl-9"
                    aria-label="Search customers"
                  />
                </div>
                <div
                  className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1"
                  role="listbox"
                  aria-label="Customers"
                >
                  {filtered.map((c) => {
                    const active = activeUpgradeFor(c.id, doc)
                    const selected = c.id === customerId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        aria-disabled={!!active}
                        onClick={() => !active && setCustomerId(c.id)}
                        onDoubleClick={() => {
                          if (!active) {
                            setCustomerId(c.id)
                            setFromFamily(lastFamilyOf(c.id) ?? fromFamily)
                            go(1)
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                          selected
                            ? 'border-accent bg-accent-soft'
                            : 'border-border hover:border-border-strong hover:bg-surface-2',
                          active ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                        )}
                      >
                        <CustomerChip
                          logo={c.logo}
                          color={c.color}
                          label={c.name}
                          className="font-medium"
                        />
                        {active ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-subtle">
                            <Lock className="h-3 w-3" /> Active: {active.fromFamily} →{' '}
                            {active.family}
                          </span>
                        ) : (
                          selected && <Check className="h-4 w-4 text-accent-text" />
                        )}
                      </button>
                    )
                  })}
                  {filtered.length === 0 && (
                    <p className="py-6 text-center text-sm text-subtle">No customers match.</p>
                  )}
                </div>
                <div className="flex gap-2 border-t border-border pt-3">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
                    placeholder="Or add a new customer…"
                    aria-label="New customer name"
                  />
                  <Button onClick={quickAdd} disabled={!newName.trim()}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <p className="text-xs text-subtle">
                  Each customer does one upgrade at a time: customers with an active upgrade are
                  locked.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-sm text-muted">
                  For <span className="font-semibold text-text">{customer?.name}</span>
                </div>
                <Field label="From release" htmlFor="nu-from">
                  <Input
                    id="nu-from"
                    list="nu-families"
                    value={fromFamily}
                    onChange={(e) => setFromFamily(e.target.value)}
                    autoFocus
                  />
                </Field>
                <Field label="To release" htmlFor="nu-to">
                  <Input
                    id="nu-to"
                    list="nu-families"
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                  />
                </Field>
                <Field
                  label="Cycle"
                  htmlFor="nu-cycle"
                  hint="Follows the PROD date until you change it."
                >
                  <Input
                    id="nu-cycle"
                    value={cycle}
                    onChange={(e) => {
                      setCycle(e.target.value)
                      setCycleTouched(true)
                    }}
                  />
                </Field>
                <Field label="ServiceNow case link (optional)" htmlFor="nu-case">
                  <Input
                    id="nu-case"
                    value={caseUrl}
                    onChange={(e) => setCaseUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <datalist id="nu-families">
                  {FAMILY_SUGGESTIONS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-3">
                {ENV_KEYS.map((env) => {
                  const w = windows[env]
                  return (
                    <div
                      key={env}
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-xl border border-border p-3',
                        !w && 'bg-pattern-dots',
                      )}
                    >
                      <div className="w-14 font-heading text-sm font-bold">{ENV_LABEL[env]}</div>
                      {env === 'uat' && (
                        <label className="mr-2 flex items-center gap-2 text-xs text-muted">
                          <Switch checked={!!w} onCheckedChange={toggleUat} label="Has UAT" />
                          {w ? 'UAT' : 'N/A'}
                        </label>
                      )}
                      {w ? (
                        <>
                          <input
                            type="date"
                            aria-label={`${ENV_LABEL[env]} date`}
                            value={w.start.slice(0, 10)}
                            onChange={(e) =>
                              /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) &&
                              setWin(env, { start: `${e.target.value}${w.start.slice(10)}` })
                            }
                            className={cn(fieldCls, 'w-[9rem]')}
                          />
                          <input
                            type="time"
                            aria-label={`${ENV_LABEL[env]} time`}
                            value={w.start.slice(11, 16)}
                            onChange={(e) =>
                              e.target.value &&
                              setWin(env, { start: `${w.start.slice(0, 10)}T${e.target.value}` })
                            }
                            className={cn(fieldCls, 'w-[6rem]')}
                          />
                          <div className="w-56">
                            <TimeZoneSelect
                              value={w.timeZone}
                              onChange={(tz) => setWin(env, { timeZone: tz })}
                              ariaLabel={`${ENV_LABEL[env]} time zone`}
                            />
                          </div>
                          <label className="flex items-center gap-1 text-xs text-muted">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              aria-label={`${ENV_LABEL[env]} duration in hours`}
                              value={w.durationHours}
                              onChange={(e) =>
                                Number(e.target.value) > 0 &&
                                setWin(env, { durationHours: Number(e.target.value) })
                              }
                              className={cn(fieldCls, 'w-16')}
                            />
                            h
                          </label>
                          <span className="ml-auto text-xs text-subtle">
                            {formatDay(w.start.slice(0, 10))}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-subtle">
                          No UAT: its steps will be created with status N/A.
                        </span>
                      )}
                    </div>
                  )
                })}
                {warnings.length > 0 && (
                  <p className="flex items-center gap-2 text-sm text-warning" role="alert">
                    <AlertTriangle className="h-4 w-4" /> {warnings.join(' ')}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-subtle">Customer</span> <b>{customer?.name}</b>
                  </span>
                  <span>
                    <span className="text-subtle">Release</span>{' '}
                    <b>
                      {fromFamily} → {family}
                    </b>
                  </span>
                  <span>
                    <span className="text-subtle">Steps</span> <b>{preview.length}</b>
                  </span>
                </div>
                {firstDate && firstDate < today && (
                  <p className="flex items-center gap-2 text-xs text-warning" role="alert">
                    <AlertTriangle className="h-4 w-4" /> The first step ({formatDay(firstDate)}) is
                    already in the past.
                  </p>
                )}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                  {PHASES.map((phase: Phase) => {
                    const rows = preview.filter((t) => t.phase === phase)
                    if (rows.length === 0) return null
                    return (
                      <div key={phase}>
                        <div className="sticky top-0 flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-1.5">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ backgroundColor: `var(--tone-${phaseTone[phase]}-solid)` }}
                          />
                          <span className="eyebrow !text-text">{phase}</span>
                        </div>
                        {rows.map((t, i) => (
                          <motion.div
                            key={t.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(i * 0.02, 0.2) }}
                            className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5 text-xs"
                          >
                            <span className={cn('truncate', !t.start && 'text-subtle')}>
                              {t.name}
                            </span>
                            <span className="shrink-0 text-muted tabular">
                              {t.start
                                ? t.start === t.end
                                  ? formatDay(t.start)
                                  : `${formatDay(t.start, 'EEE d MMM')} to ${formatDay(t.end)}`
                                : 'N/A'}
                              {t.time ? ` ${t.time.start}` : ''}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => (step === 0 ? setOpen(false) : go(step - 1))}>
          {step === 0 ? (
            'Cancel'
          ) : (
            <>
              <ArrowLeft className="h-4 w-4" /> Back
            </>
          )}
        </Button>
        {blocking && step === 0 && (
          <span className="text-xs text-warning">
            {customer?.name} already has an active upgrade ({blocking.fromFamily} →{' '}
            {blocking.family}).
          </span>
        )}
        {step < 3 ? (
          <Button
            variant="primary"
            disabled={!canNext}
            onClick={() => {
              if (step === 0) setFromFamily(lastFamilyOf(customerId) ?? fromFamily)
              go(step + 1)
            }}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="primary" onClick={create}>
            <Rocket className="h-4 w-4" /> Create upgrade
          </Button>
        )}
      </div>
    </div>
  )
}

/** "New upgrade" flow: customer → releases → windows → preview → create. */
export function NewUpgradeDialog() {
  const open = useUi((s) => s.newUpgradeOpen)
  const setOpen = useUi((s) => s.setNewUpgradeOpen)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => setOpen(o)}
      title="New upgrade"
      description="Plan a family-release upgrade from the standard template."
      className="w-[min(94vw,760px)]"
    >
      {open && <Body />}
    </Dialog>
  )
}
