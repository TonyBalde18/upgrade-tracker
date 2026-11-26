/**
 * Pure upgrade operations (no store, no UI) so they can be unit tested.
 */
import { addDaysIso, weekdayOf } from '@/lib/dates'
import { newId } from '@/lib/id'
import { newGoNoGo } from '@/lib/model/defaults'
import type {
  Customer,
  EnvKey,
  ExtraWindow,
  Settings,
  Task,
  Template,
  TrackerDoc,
  Upgrade,
  UpgradeWindow,
} from '@/lib/model/types'
import {
  fillFamily,
  firstStatusOf,
  generateTasks,
  scheduleStep,
  statusCategory,
  type Windows,
} from '@/lib/template/schedule'

export const ENV_LABEL: Record<EnvKey, string> = { dev: 'DEV', uat: 'UAT', prod: 'PROD' }

/** What this customer calls an environment ("PRP" for the test one...). */
export function envLabel(env: EnvKey, customer?: Pick<Customer, 'envNames'> | null): string {
  return customer?.envNames?.[env]?.trim() || ENV_LABEL[env]
}

/** Label of a phase for a customer: the test phase uses their test environment name. */
export function phaseLabel(phase: string, customer?: Pick<Customer, 'envNames'> | null): string {
  return phase === 'UAT' ? envLabel('uat', customer) : phase
}

/** A window of an upgrade, standard or extra, with its display name. */
export interface NamedWindow {
  /** "dev" | "uat" | "prod" or "x:<id>" for an extra window */
  key: string
  env: EnvKey | null
  label: string
  window: UpgradeWindow
  extra?: ExtraWindow
}

/** A window by key: "dev" | "uat" | "prod" | "x:<id>". */
export function windowByKey(
  u: Pick<Upgrade, 'windows' | 'extraWindows'>,
  key: string,
): UpgradeWindow | null {
  if (key === 'dev' || key === 'uat' || key === 'prod') return u.windows[key]
  return u.extraWindows?.find((x) => `x:${x.id}` === key) ?? null
}

/** Display name of a window by key. */
export function windowName(
  u: Pick<Upgrade, 'extraWindows'>,
  key: string,
  customer?: Pick<Customer, 'envNames'> | null,
): string {
  if (key === 'dev' || key === 'uat' || key === 'prod') return envLabel(key, customer)
  return u.extraWindows?.find((x) => `x:${x.id}` === key)?.name || 'Extra'
}

/** Every window of an upgrade in date order (standard ones plus extra ones). */
export function allWindows(
  u: Pick<Upgrade, 'windows' | 'extraWindows'>,
  customer?: Pick<Customer, 'envNames'> | null,
): NamedWindow[] {
  const out: NamedWindow[] = []
  for (const env of ['dev', 'uat', 'prod'] as const) {
    const w = u.windows[env]
    if (w) out.push({ key: env, env, label: envLabel(env, customer), window: w })
  }
  for (const x of u.extraWindows ?? [])
    out.push({ key: `x:${x.id}`, env: null, label: x.name || 'Extra', window: x, extra: x })
  return out.sort((a, b) => a.window.start.localeCompare(b.window.start))
}

// --- upgrade state -------------------------------------------------------------

/** An upgrade is active until its schedule status is Done or Cancelled. */
export function isActiveUpgrade(u: Upgrade, settings: Pick<Settings, 'scheduleStatuses'>): boolean {
  const cat = statusCategory(settings.scheduleStatuses, u.scheduleStatus)
  return cat !== 'done' && cat !== 'cancelled'
}

/** The customer's active upgrade, if any (each customer does one upgrade at a time). */
export function activeUpgradeFor(
  customerId: string,
  doc: Pick<TrackerDoc, 'upgrades' | 'settings'>,
  exceptId?: string,
): Upgrade | undefined {
  return doc.upgrades.find(
    (u) => u.customerId === customerId && u.id !== exceptId && isActiveUpgrade(u, doc.settings),
  )
}

export function upgradeLabel(
  u: Pick<Upgrade, 'family' | 'customerId'>,
  customers: Customer[],
): string {
  const c = customers.find((x) => x.id === u.customerId)
  return `${c?.name ?? 'Unknown customer'} - ${u.family}`
}

// --- cycles --------------------------------------------------------------------

/** "2026-H2" -> "2027-H1". Unknown formats are returned unchanged. */
export function nextCycle(cycle: string): string {
  const m = /^(\d{4})-H([12])$/.exec(cycle.trim())
  if (!m) return cycle
  const y = Number(m[1])
  return m[2] === '1' ? `${y}-H2` : `${y + 1}-H1`
}

export function cycleForDate(iso: string): string {
  const [y, mo] = iso.split('-').map(Number)
  return `${y}-H${(mo ?? 1) <= 6 ? 1 : 2}`
}

// --- windows -------------------------------------------------------------------

export function makeWindow(
  date: string,
  time: string,
  timeZone: string,
  durationHours: number,
  status: string,
  now: Date = new Date(),
): UpgradeWindow {
  return {
    start: `${date}T${time}`,
    timeZone,
    durationHours,
    status,
    updatedAt: now.toISOString(),
    goNoGo: newGoNoGo(),
  }
}

/** First Tuesday on or after a date. */
export function nextTuesday(iso: string): string {
  const wd = weekdayOf(iso)
  return addDaysIso(iso, (2 - wd + 7) % 7)
}

/** Sensible defaults for a new upgrade: DEV on a Tuesday ~3 weeks out, UAT +7, PROD +21. */
export function defaultWindows(
  today: string,
  settings: Pick<
    Settings,
    'defaultWindowTimeZone' | 'defaultWindowDurationHours' | 'windowStatuses'
  >,
  now: Date = new Date(),
): Windows {
  const dev = nextTuesday(addDaysIso(today, 21))
  const planned = firstStatusOf(settings.windowStatuses, 'planned')?.id ?? 'ws-planned'
  const mk = (d: string) =>
    makeWindow(
      d,
      '00:15',
      settings.defaultWindowTimeZone,
      settings.defaultWindowDurationHours,
      planned,
      now,
    )
  return { dev: mk(dev), uat: mk(addDaysIso(dev, 7)), prod: mk(addDaysIso(dev, 21)) }
}

export function shiftWindow(w: UpgradeWindow, days: number, now: Date = new Date()): UpgradeWindow {
  if (days === 0) return w
  return {
    ...w,
    start: `${addDaysIso(w.start.slice(0, 10), days)}${w.start.slice(10)}`,
    updatedAt: now.toISOString(),
  }
}

/** Warnings about window order (DEV before UAT before PROD). */
export function windowWarnings(windows: Windows): string[] {
  const out: string[] = []
  const d = windows.dev.start
  const u = windows.uat?.start
  const p = windows.prod.start
  if (u && u < d) out.push('UAT is before DEV.')
  if (p < d) out.push('PROD is before DEV.')
  if (u && p < u) out.push('PROD is before UAT.')
  return out
}

// --- task operations -----------------------------------------------------------

export function shiftTask(t: Task, days: number, now: Date = new Date()): Task {
  if (days === 0 || (!t.start && !t.end)) return t
  return {
    ...t,
    start: t.start ? addDaysIso(t.start, days) : null,
    end: t.end ? addDaysIso(t.end, days) : null,
    updatedAt: now.toISOString(),
  }
}

export function shiftUpgrade(
  u: Pick<Upgrade, 'windows' | 'tasks'> & { extraWindows?: ExtraWindow[] },
  days: number,
  includeWindows: boolean,
  now: Date = new Date(),
): Pick<Upgrade, 'windows' | 'tasks' | 'extraWindows'> {
  return {
    extraWindows: (u.extraWindows ?? []).map((x) =>
      includeWindows ? { ...x, ...shiftWindow(x, days, now) } : x,
    ),
    windows: includeWindows
      ? {
          dev: shiftWindow(u.windows.dev, days, now),
          uat: u.windows.uat ? shiftWindow(u.windows.uat, days, now) : null,
          prod: shiftWindow(u.windows.prod, days, now),
        }
      : u.windows,
    tasks: u.tasks.map((t) => shiftTask(t, days, now)),
  }
}

/** Sort by order and renumber 0..n-1. */
export function normalizeOrder(tasks: Task[]): Task[] {
  return [...tasks]
    .sort((a, b) => a.order - b.order)
    .map((t, i) => (t.order === i ? t : { ...t, order: i }))
}

/** Move a task before/after another one (drag and drop). Phase follows the target. */
export function moveTask(tasks: Task[], activeId: string, overId: string): Task[] {
  const sorted = [...tasks].sort((a, b) => a.order - b.order)
  const from = sorted.findIndex((t) => t.id === activeId)
  const to = sorted.findIndex((t) => t.id === overId)
  if (from < 0 || to < 0 || from === to) return tasks
  const over = sorted[to]!
  const [item] = sorted.splice(from, 1)
  if (!item) return tasks
  sorted.splice(to, 0, over.phase !== item.phase ? { ...item, phase: over.phase } : item)
  return sorted.map((t, i) => (t.order === i ? t : { ...t, order: i }))
}

/** The "Upgrade DEV/UAT/PROD to … release" task linked to a window. */
export function windowTaskId(
  u: Pick<Upgrade, 'tasks'>,
  template: Template,
  env: EnvKey,
): string | undefined {
  const stepIds = new Set(
    template.steps
      .filter((s) => s.anchor === env && s.timeMode === 'window' && s.offsetDays === 0)
      .map((s) => s.id),
  )
  const byStep = u.tasks.find((t) => t.templateStepId && stepIds.has(t.templateStepId))
  if (byStep) return byStep.id
  const re = new RegExp(`^upgrade\\s+${env}\\b`, 'i')
  return u.tasks.find((t) => re.test(t.name))?.id
}

/** Which window a task is the "upgrade" task for (inverse of windowTaskId). */
export function windowOfTask(
  u: Pick<Upgrade, 'tasks'>,
  template: Template,
  taskId: string,
): EnvKey | undefined {
  return (['dev', 'uat', 'prod'] as const).find((env) => windowTaskId(u, template, env) === taskId)
}

/**
 * Add or remove the UAT window. Removing marks UAT-anchored steps N/A (dates cleared);
 * adding re-schedules them (manual dates are kept).
 */
export function setUatWindow(
  u: Pick<Upgrade, 'windows' | 'tasks'>,
  uat: UpgradeWindow | null,
  template: Template,
  settings: Pick<Settings, 'taskStatuses'>,
  now: Date = new Date(),
): Pick<Upgrade, 'windows' | 'tasks'> {
  const windows = { ...u.windows, uat }
  const steps = new Map(template.steps.filter((s) => s.anchor === 'uat').map((s) => [s.id, s]))
  const na = firstStatusOf(settings.taskStatuses, 'na')?.id ?? 'ts-na'
  const planned = firstStatusOf(settings.taskStatuses, 'planned')?.id ?? 'ts-not-started'
  const stamp = now.toISOString()
  const tasks = u.tasks.map((t) => {
    const step = t.templateStepId ? steps.get(t.templateStepId) : undefined
    if (!step) return t
    if (!uat) return { ...t, status: na, start: null, end: null, time: null, updatedAt: stamp }
    const s = scheduleStep(step, windows)
    const wasNa = statusCategory(settings.taskStatuses, t.status) === 'na'
    if (t.datesManuallySet && t.start)
      return wasNa ? { ...t, status: planned, updatedAt: stamp } : t
    return {
      ...t,
      start: s.start,
      end: s.end,
      time: s.time,
      status: wasNa ? planned : t.status,
      updatedAt: stamp,
    }
  })
  return { windows, tasks }
}

/**
 * Re-apply the current template to an upgrade. Keeps status, notes, link, owner,
 * assignee and manual dates of existing steps; adds new steps; steps removed from the
 * template become custom tasks (nothing is deleted). Custom tasks are kept in place.
 */
export function applyTemplate(
  u: Pick<Upgrade, 'windows' | 'tasks' | 'family'>,
  template: Template,
  settings: Pick<Settings, 'taskStatuses'>,
  now: Date = new Date(),
  testName = 'UAT',
): { tasks: Task[]; added: number; detached: number } {
  const stamp = now.toISOString()
  const byStep = new Map(u.tasks.filter((t) => t.templateStepId).map((t) => [t.templateStepId!, t]))
  const stepIds = new Set(template.steps.map((s) => s.id))
  const fresh = generateTasks({
    template,
    windows: u.windows,
    family: u.family,
    settings,
    now,
    testName,
  })
  let added = 0
  const fromTemplate = template.steps.map((step, i) => {
    const existing = byStep.get(step.id)
    const gen = fresh[i]!
    if (!existing) {
      added++
      return gen
    }
    const keepDates = existing.datesManuallySet
    return {
      ...existing,
      name: fillFamily(step.name, u.family, testName),
      phase: step.phase,
      kind: step.kind,
      start: keepDates ? existing.start : gen.start,
      end: keepDates ? existing.end : gen.end,
      time: keepDates ? existing.time : gen.time,
      status: gen.status !== existing.status && !gen.start ? gen.status : existing.status,
      order: i,
      updatedAt: stamp,
    }
  })
  let detached = 0
  const others = u.tasks
    .filter((t) => !t.templateStepId || !stepIds.has(t.templateStepId))
    .map((t) => {
      if (t.templateStepId) {
        detached++
        return { ...t, templateStepId: null, updatedAt: stamp }
      }
      return t
    })
  // custom tasks go after the template step that preceded them before
  const sortedOld = [...u.tasks].sort((a, b) => a.order - b.order)
  const result: Task[] = [...fromTemplate]
  for (const t of others) {
    const idx = sortedOld.findIndex((x) => x.id === t.id)
    let anchorIdx = -1
    for (let k = idx - 1; k >= 0; k--) {
      const prev = sortedOld[k]!
      const pos = result.findIndex((r) => r.id === prev.id)
      if (pos >= 0) {
        anchorIdx = pos
        break
      }
    }
    result.splice(anchorIdx + 1, 0, t)
  }
  return {
    tasks: result.map((t, i) => (t.order === i ? t : { ...t, order: i })),
    added,
    detached,
  }
}

// --- creation ------------------------------------------------------------------

export interface NewUpgradeInput {
  customerId: string
  family: string
  fromFamily: string
  cycle: string
  snCaseUrl: string
  windows: Windows
  /** the customer's name for the test environment, used in step names */
  testName?: string
}

export function buildUpgrade(
  input: NewUpgradeInput,
  template: Template,
  settings: Pick<Settings, 'taskStatuses' | 'scheduleStatuses'>,
  now: Date = new Date(),
): Upgrade {
  const stamp = now.toISOString()
  return {
    id: newId('upg'),
    customerId: input.customerId,
    family: input.family.trim(),
    fromFamily: input.fromFamily.trim(),
    cycle: input.cycle.trim(),
    scheduleStatus: firstStatusOf(settings.scheduleStatuses, 'planned')?.id ?? 'ss-requested',
    snCaseUrl: input.snCaseUrl.trim(),
    notes: '',
    windows: input.windows,
    extraWindows: [],
    documents: [],
    lessonsLearned: '',
    tasks: generateTasks({
      template,
      windows: input.windows,
      family: input.family.trim(),
      settings,
      testName: input.testName,
      now,
    }),
    canvas: {},
    log: [{ at: stamp, text: 'Upgrade created from the template', kind: 'auto' }],
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** Copy an upgrade for the next cycle: windows shifted, a fresh plan from the template. */
export function duplicateForNextCycle(
  u: Upgrade,
  opts: { family: string; cycle: string; shiftDays: number; testName?: string },
  template: Template,
  settings: Pick<Settings, 'taskStatuses' | 'scheduleStatuses' | 'windowStatuses'>,
  now: Date = new Date(),
): Upgrade {
  const planned = firstStatusOf(settings.windowStatuses, 'planned')?.id ?? 'ws-planned'
  const shift = (w: UpgradeWindow) => ({
    ...shiftWindow(w, opts.shiftDays, now),
    status: planned,
    goNoGo: newGoNoGo(),
  })
  const windows: Windows = {
    dev: shift(u.windows.dev),
    uat: u.windows.uat ? shift(u.windows.uat) : null,
    prod: shift(u.windows.prod),
  }
  const copy = buildUpgrade(
    {
      customerId: u.customerId,
      family: opts.family,
      fromFamily: u.family,
      cycle: opts.cycle,
      snCaseUrl: '',
      windows,
      testName: opts.testName,
    },
    template,
    settings,
    now,
  )
  copy.log = [
    {
      at: now.toISOString(),
      text: `Duplicated from ${u.fromFamily} → ${u.family} (${u.cycle})`,
      kind: 'auto',
    },
  ]
  return copy
}

/** Days between window dates, keeping the weekday: 26 weeks by default (next half-year). */
export const NEXT_CYCLE_SHIFT_DAYS = 182
