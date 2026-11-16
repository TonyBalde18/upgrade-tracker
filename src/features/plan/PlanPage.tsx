import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CalendarClock,
  Copy,
  ExternalLink,
  History,
  LayoutTemplate,
  MoreHorizontal,
  MoveHorizontal,
  RefreshCw,
  Rocket,
  Trash2,
} from 'lucide-react'
import { undo, useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import type { EnvKey, Task, UpgradeWindow } from '@/lib/model/types'
import { ENV_KEYS } from '@/lib/model/types'
import { addDaysIso } from '@/lib/dates'
import { countManual, firstStatusOf, progressOf, statusCategory } from '@/lib/template/schedule'
import {
  ENV_LABEL,
  activeUpgradeFor,
  isActiveUpgrade,
  makeWindow,
  windowOfTask,
  windowTaskId,
  windowWarnings,
} from '@/lib/upgrade/logic'
import {
  applyTemplateToUpgrade,
  deleteUpgrade,
  duplicateUpgrade,
  recalculate,
  setUat,
  shiftDates,
  updateTask,
  updateUpgradeMeta,
  updateWindow,
} from '@/store/upgradeActions'
import { readString, writeString } from '@/lib/storage/local'
import { Button } from '@/components/ui/Button'
import { CustomerChip } from '@/components/ui/misc'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Segmented } from '@/components/ui/Segmented'
import { Tooltip } from '@/components/ui/Tooltip'
import { Celebration } from '@/components/ui/Celebration'
import { confirm } from '@/components/ui/confirm'
import { StatusCell } from './cells'
import { WindowCard } from './WindowCard'
import { TaskTable, safeUrl, type TableMode } from './TaskTable'
import { ActivityLog } from './ActivityLog'
import { DuplicateDialog, RecalcDialog, ShiftDialog } from './PlanDialogs'
import { useToday } from './gantt'

const menuItem =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-40'

function HeadingInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  label: string
  className?: string
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={label}
      size={Math.max(4, value.length + 1)}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v && v !== value) onCommit(v)
        else e.target.value = value
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = value
          e.currentTarget.blur()
        }
      }}
      className={`min-w-0 rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-accent focus:outline-none ${className ?? ''}`}
    />
  )
}

export default function PlanPage() {
  const { upgradeId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const doc = useTracker((s) => s.doc)
  const { settings, template } = doc
  const upgrade = doc.upgrades.find((u) => u.id === upgradeId)
  const customer = doc.customers.find((c) => c.id === upgrade?.customerId)
  const today = useToday(settings.displayTimeZone)

  const [mode, setModeState] = useState<TableMode>(() =>
    readString('planMode') === 'table' ? 'table' : 'split',
  )
  const setMode = (m: TableMode) => {
    setModeState(m)
    writeString('planMode', m)
  }
  const [logOpen, setLogOpen] = useState(false)
  const [recalcOpen, setRecalcOpen] = useState(false)
  const [shiftOpen, setShiftOpen] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const progress = upgrade ? progressOf(upgrade.tasks, settings.taskStatuses) : 0
  const prevProgress = useRef(progress)
  useEffect(() => {
    if (prevProgress.current < 1 && progress >= 1 && upgrade) {
      setCelebrate(true)
      const done = firstStatusOf(settings.scheduleStatuses, 'done')
      if (done && statusCategory(settings.scheduleStatuses, upgrade.scheduleStatus) !== 'done') {
        toast.success('Every step is complete', {
          description: `Mark the upgrade as "${done.label}"?`,
          action: {
            label: `Mark ${done.label}`,
            onClick: () => updateUpgradeMeta(upgrade.id, { scheduleStatus: done.id }),
          },
          duration: 10000,
        })
      }
    }
    prevProgress.current = progress
  }, [progress, upgrade, settings.scheduleStatuses])

  // --- linking windows and their "Upgrade …" task
  const onTaskStatus = useCallback(
    (task: Task, status: string) => {
      const state = useTracker.getState().doc
      const u = state.upgrades.find((x) => x.id === upgradeId)
      if (!u) return
      updateTask(u.id, task.id, { status })
      const env = windowOfTask(u, state.template, task.id)
      const win = env ? u.windows[env] : null
      if (env && win && statusCategory(state.settings.taskStatuses, status) === 'done') {
        const wDone = firstStatusOf(state.settings.windowStatuses, 'done')
        if (wDone && statusCategory(state.settings.windowStatuses, win.status) !== 'done') {
          toast(`Mark the ${ENV_LABEL[env]} window as ${wDone.label} too?`, {
            action: {
              label: `Mark ${ENV_LABEL[env]} ${wDone.label}`,
              onClick: () => updateWindow(u.id, env, { status: wDone.id }),
            },
            duration: 8000,
          })
        }
      }
    },
    [upgradeId],
  )

  if (!upgrade) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<Rocket />}
          title="Upgrade not found"
          body="It may have been deleted or the link is from other data."
          actions={
            <Link to="/">
              <Button>Back to dashboard</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const onWindowChange = (env: EnvKey, patch: Partial<Omit<UpgradeWindow, 'updatedAt'>>) => {
    updateWindow(upgrade.id, env, patch)
    if (patch.start) {
      toast(`${ENV_LABEL[env]} window moved`, {
        description: 'Recalculate the task dates from the windows?',
        action: { label: 'Recalculate', onClick: () => startRecalc() },
        duration: 8000,
      })
    }
    if (patch.status && statusCategory(settings.windowStatuses, patch.status) === 'done') {
      const taskId = windowTaskId(upgrade, template, env)
      const task = upgrade.tasks.find((t) => t.id === taskId)
      const tDone = firstStatusOf(settings.taskStatuses, 'done')
      if (task && tDone && statusCategory(settings.taskStatuses, task.status) !== 'done') {
        toast(`Complete "${task.name}" too?`, {
          action: {
            label: `Mark ${tDone.label}`,
            onClick: () => updateTask(upgrade.id, task.id, { status: tDone.id }),
          },
          duration: 8000,
        })
      }
    }
  }

  const runRecalc = (overwrite: boolean) => {
    setRecalcOpen(false)
    const r = recalculate(upgrade.id, overwrite)
    toast.success(
      r.changed ? `${r.changed} task date(s) updated` : 'Dates already match the windows',
      {
        description: r.skipped && !overwrite ? `${r.skipped} manual date(s) kept.` : undefined,
      },
    )
  }
  const startRecalc = () => {
    const u = useTracker.getState().doc.upgrades.find((x) => x.id === upgrade.id)
    if (u && countManual(u.tasks) > 0) setRecalcOpen(true)
    else runRecalc(false)
  }

  const addUat = () => {
    const planned = firstStatusOf(settings.windowStatuses, 'planned')?.id ?? 'ws-planned'
    const dev = upgrade.windows.dev
    setUat(
      upgrade.id,
      makeWindow(
        addDaysIso(dev.start.slice(0, 10), 7),
        dev.start.slice(11, 16),
        dev.timeZone,
        dev.durationHours,
        planned,
      ),
    )
  }
  const removeUat = async () => {
    if (
      await confirm({
        title: 'No UAT for this upgrade?',
        body: 'The UAT window is removed and the UAT steps are kept with status N/A. You can add UAT again later (Ctrl+Z also works).',
        confirmLabel: 'Set UAT to N/A',
      })
    )
      setUat(upgrade.id, null)
  }

  const blockedDuplicate = (() => {
    if (isActiveUpgrade(upgrade, settings))
      return 'Each customer does one upgrade at a time. Mark this upgrade Done (or Cancelled) before planning the next cycle.'
    const other = activeUpgradeFor(upgrade.customerId, doc, upgrade.id)
    if (other)
      return `${customer?.name ?? 'This customer'} already has an active upgrade (${other.fromFamily} → ${other.family}).`
    return null
  })()

  const warnings = windowWarnings(upgrade.windows)
  const caseUrl = safeUrl(upgrade.snCaseUrl)

  return (
    <div className="relative flex h-full flex-col gap-4 overflow-hidden px-6 pt-5 pb-5">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <Tooltip content="Back">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Tooltip>
        <ProgressRing value={progress} size={52} />
        <div className="min-w-0">
          <Link
            to={customer ? `/customers/${customer.id}` : '/customers'}
            className="hover:underline"
          >
            <CustomerChip
              logo={customer?.logo}
              color={customer?.color ?? '#999'}
              label={customer?.name ?? 'Unknown customer'}
              className="eyebrow !text-muted"
            />
          </Link>
          <h1 className="flex flex-wrap items-center gap-1 text-xl font-bold">
            <HeadingInput
              value={upgrade.fromFamily}
              label="From release"
              onCommit={(fromFamily) => updateUpgradeMeta(upgrade.id, { fromFamily })}
              className="text-muted"
            />
            <ArrowRight className="h-4 w-4 text-accent-text" aria-label="to" />
            <HeadingInput
              value={upgrade.family}
              label="Target release"
              onCommit={(family) => updateUpgradeMeta(upgrade.id, { family })}
            />
            <span className="ml-2 rounded-md bg-surface-3 px-1 text-sm font-medium text-muted">
              <HeadingInput
                value={upgrade.cycle}
                label="Cycle"
                onCommit={(cycle) => updateUpgradeMeta(upgrade.id, { cycle })}
              />
            </span>
          </h1>
        </div>
        <StatusCell
          value={upgrade.scheduleStatus}
          statuses={settings.scheduleStatuses}
          onCommit={(scheduleStatus) => updateUpgradeMeta(upgrade.id, { scheduleStatus })}
          ariaLabel="Schedule status"
          size="md"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-lg border border-border bg-surface pr-1 pl-3">
            <input
              key={upgrade.snCaseUrl}
              defaultValue={upgrade.snCaseUrl}
              placeholder="ServiceNow case link"
              aria-label="ServiceNow case link"
              onBlur={(e) =>
                e.target.value.trim() !== upgrade.snCaseUrl &&
                updateUpgradeMeta(upgrade.id, { snCaseUrl: e.target.value.trim() })
              }
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-44 bg-transparent text-xs outline-none placeholder:text-subtle"
            />
            {caseUrl ? (
              <a
                href={caseUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded p-1.5 text-subtle hover:text-accent-text"
                aria-label="Open ServiceNow case"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="w-6" />
            )}
          </div>
          <Segmented<TableMode>
            ariaLabel="Layout"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'split', label: 'Plan + Gantt' },
              { value: 'table', label: 'Full table' },
            ]}
          />
          <Button onClick={() => setLogOpen((v) => !v)} aria-pressed={logOpen}>
            <History className="h-4 w-4" /> Activity
          </Button>
          <Tooltip content="Recalculate dates from the windows">
            <Button onClick={startRecalc} aria-label="Recalculate dates from windows">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </Tooltip>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="ut-pop z-50 min-w-60 rounded-xl border border-border bg-surface p-1 shadow-lift"
              >
                <DropdownMenu.Item className={menuItem} onSelect={startRecalc}>
                  <RefreshCw className="h-4 w-4" /> Recalculate dates from windows
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => setShiftOpen(true)}>
                  <MoveHorizontal className="h-4 w-4" /> Shift all dates by N days…
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Apply the current template?',
                        body: 'Step names, phases and template dates are refreshed. Status, notes, owners and dates you set by hand are kept. New steps are added; removed steps stay as custom tasks.',
                        confirmLabel: 'Apply template',
                      })
                    ) {
                      const r = applyTemplateToUpgrade(upgrade.id)
                      toast.success('Template applied', {
                        description: `${r.added} new step(s), ${r.detached} kept as custom.`,
                      })
                    }
                  }}
                >
                  <LayoutTemplate className="h-4 w-4" /> Apply template to this upgrade…
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => setDupOpen(true)}>
                  <Copy className="h-4 w-4" /> Duplicate for next cycle…
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() =>
                    useUi.getState().setIcsTarget({ kind: 'upgrade', id: upgrade.id })
                  }
                >
                  <CalendarPlus className="h-4 w-4" /> Export to calendar (.ics)…
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className={`${menuItem} text-danger`}
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Delete this upgrade?',
                        body: `${customer?.name ?? ''} ${upgrade.fromFamily} → ${upgrade.family} and its ${upgrade.tasks.length} tasks will be removed. Ctrl+Z can bring it back during this session.`,
                        confirmLabel: 'Delete upgrade',
                        danger: true,
                      })
                    ) {
                      deleteUpgrade(upgrade.id)
                      navigate('/')
                      toast('Upgrade deleted', { action: { label: 'Undo', onClick: undo } })
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete upgrade
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* windows */}
      <motion.div layout className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
        {ENV_KEYS.map((env) => (
          <WindowCard
            key={env}
            env={env}
            window={upgrade.windows[env]}
            settings={settings}
            instanceUrl={safeUrl(customer?.instances[env] ?? '') ?? undefined}
            onChange={(patch) => onWindowChange(env, patch)}
            onRemove={env === 'uat' ? () => void removeUat() : undefined}
            onAdd={env === 'uat' ? addUat : undefined}
          />
        ))}
      </motion.div>
      {warnings.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-warning" role="alert">
          <CalendarClock className="h-4 w-4" /> {warnings.join(' ')}
        </div>
      )}

      <TaskTable
        upgrade={upgrade}
        settings={settings}
        template={template}
        mode={mode}
        today={today}
        highlightTaskId={params.get('task')}
        onStatus={onTaskStatus}
      />

      <ActivityLog
        upgrade={upgrade}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        tz={settings.displayTimeZone}
      />
      <RecalcDialog
        open={recalcOpen}
        manual={countManual(upgrade.tasks)}
        onClose={() => setRecalcOpen(false)}
        onRun={runRecalc}
      />
      {shiftOpen && (
        <ShiftDialog
          open
          onClose={() => setShiftOpen(false)}
          onRun={(days, windows) => {
            shiftDates(upgrade.id, days, windows)
            setShiftOpen(false)
            toast.success(`Dates shifted by ${days > 0 ? '+' : ''}${days} day(s)`, {
              action: { label: 'Undo', onClick: undo },
            })
          }}
        />
      )}
      {dupOpen && (
        <DuplicateDialog
          open
          upgrade={upgrade}
          blockedReason={blockedDuplicate}
          onClose={() => setDupOpen(false)}
          onRun={(opts) => {
            const id = duplicateUpgrade(upgrade.id, opts)
            setDupOpen(false)
            if (id) {
              navigate(`/upgrades/${id}`)
              toast.success('Next upgrade created', {
                description: `${opts.family}, ${opts.cycle}`,
              })
            }
          }}
        />
      )}
      <Celebration show={celebrate} onDone={() => setCelebrate(false)} />
    </div>
  )
}
