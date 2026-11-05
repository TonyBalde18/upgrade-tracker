/**
 * Edits to upgrades, tasks, windows, the template and customers.
 * Each call is one undo step and one line in the next save's commit message,
 * e.g. `Acme Corp - Australia: "Upgrade DEV to Australia release" → Completed`.
 */
import type { Draft } from 'immer'
import { addDaysIso, formatDay } from '@/lib/dates'
import { newId } from '@/lib/id'
import type {
  EnvKey,
  Phase,
  Task,
  TemplateStep,
  TrackerDoc,
  Upgrade,
  UpgradeWindow,
} from '@/lib/model/types'
import { defaultTemplate } from '@/lib/model/defaults'
import {
  ENV_LABEL,
  applyTemplate,
  buildUpgrade,
  duplicateForNextCycle,
  moveTask,
  setUatWindow,
  shiftUpgrade,
  type NewUpgradeInput,
} from '@/lib/upgrade/logic'
import { fillFamily, recalculateTasks, firstStatusOf } from '@/lib/template/schedule'
import { useTracker } from './tracker'

const st = () => useTracker.getState()

function label(doc: TrackerDoc, u: Pick<Upgrade, 'customerId' | 'family'>): string {
  const c = doc.customers.find((x) => x.id === u.customerId)
  return `${c?.name ?? 'Unknown'} - ${u.family}`
}

function statusLabel(
  doc: TrackerDoc,
  list: 'scheduleStatuses' | 'windowStatuses' | 'taskStatuses',
  id: string,
) {
  return doc.settings[list].find((s) => s.id === id)?.label ?? id
}

/** Run a recipe on one upgrade draft; bumps updatedAt. */
function editUpgrade(
  id: string,
  description: (doc: TrackerDoc, u: Upgrade) => string,
  recipe: (u: Draft<Upgrade>, doc: Draft<TrackerDoc>) => void,
) {
  const doc = st().doc
  const u = doc.upgrades.find((x) => x.id === id)
  if (!u) return
  st().commit(description(doc, u), (d) => {
    const du = d.upgrades.find((x) => x.id === id)
    if (!du) return
    recipe(du, d)
    du.updatedAt = new Date().toISOString()
  })
}

function log(u: Draft<Upgrade>, text: string, kind: 'auto' | 'note' = 'auto') {
  u.log.unshift({ at: new Date().toISOString(), text, kind })
  if (u.log.length > 500) u.log.length = 500
}

// --- upgrades ------------------------------------------------------------------

export function createUpgrade(input: NewUpgradeInput): string {
  const doc = st().doc
  const u = buildUpgrade(input, doc.template, doc.settings)
  st().commit(
    `${label(doc, u)}: upgrade created (${u.fromFamily} → ${u.family}, ${u.cycle})`,
    (d) => {
      d.upgrades.push(u)
    },
  )
  return u.id
}

export type UpgradeMeta = Partial<
  Pick<Upgrade, 'family' | 'fromFamily' | 'cycle' | 'snCaseUrl' | 'notes' | 'scheduleStatus'>
>

export function updateUpgradeMeta(id: string, patch: UpgradeMeta) {
  editUpgrade(
    id,
    (doc, u) => {
      if (patch.scheduleStatus)
        return `${label(doc, u)}: schedule status → ${statusLabel(doc, 'scheduleStatuses', patch.scheduleStatus)}`
      return `${label(doc, u)}: edit ${Object.keys(patch).join(', ')}`
    },
    (u, d) => {
      if (patch.scheduleStatus && patch.scheduleStatus !== u.scheduleStatus) {
        log(
          u,
          `Schedule status: ${statusLabel(d as TrackerDoc, 'scheduleStatuses', u.scheduleStatus)} → ${statusLabel(d as TrackerDoc, 'scheduleStatuses', patch.scheduleStatus)}`,
        )
      }
      if (patch.family != null && patch.family !== u.family) {
        // keep generated names in step with the release ("Upgrade DEV to {family} release")
        const steps = new Map(d.template.steps.map((s) => [s.id, s]))
        for (const t of u.tasks) {
          const step = t.templateStepId ? steps.get(t.templateStepId) : undefined
          if (step && t.name === fillFamily(step.name, u.family))
            t.name = fillFamily(step.name, patch.family)
        }
        log(u, `Target release: ${u.family} → ${patch.family}`)
      }
      Object.assign(u, patch)
    },
  )
}

export function updateWindow(
  id: string,
  env: EnvKey,
  patch: Partial<Omit<UpgradeWindow, 'updatedAt'>>,
) {
  editUpgrade(
    id,
    (doc, u) => {
      if (patch.status)
        return `${label(doc, u)}: ${ENV_LABEL[env]} window → ${statusLabel(doc, 'windowStatuses', patch.status)}`
      if (patch.start)
        return `${label(doc, u)}: ${ENV_LABEL[env]} window moved to ${formatDay(patch.start.slice(0, 10))} ${patch.start.slice(11)}`
      return `${label(doc, u)}: edit ${ENV_LABEL[env]} window`
    },
    (u, d) => {
      const w = u.windows[env]
      if (!w) return
      if (patch.status && patch.status !== w.status)
        log(
          u,
          `${ENV_LABEL[env]} window: ${statusLabel(d as TrackerDoc, 'windowStatuses', w.status)} → ${statusLabel(d as TrackerDoc, 'windowStatuses', patch.status)}`,
        )
      if (patch.start && patch.start !== w.start)
        log(
          u,
          `${ENV_LABEL[env]} window moved: ${formatDay(w.start.slice(0, 10))} ${w.start.slice(11)} → ${formatDay(patch.start.slice(0, 10))} ${patch.start.slice(11)}`,
        )
      Object.assign(w, patch, { updatedAt: new Date().toISOString() })
    },
  )
}

/** Add (window) or remove (null) the UAT window. */
export function setUat(id: string, uat: UpgradeWindow | null) {
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: ${uat ? 'add UAT window' : 'UAT not applicable'}`,
    (u, d) => {
      const next = setUatWindow(
        u as Upgrade,
        uat,
        d.template as TrackerDoc['template'],
        d.settings as TrackerDoc['settings'],
      )
      u.windows = next.windows
      u.tasks = next.tasks
      log(
        u,
        uat
          ? `UAT window added (${formatDay(uat.start.slice(0, 10))})`
          : 'UAT set to N/A: UAT steps marked N/A',
      )
    },
  )
}

export function updateTask(
  id: string,
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'updatedAt'>>,
) {
  editUpgrade(
    id,
    (doc, u) => {
      const t = u.tasks.find((x) => x.id === taskId)
      const name = t?.name ?? 'task'
      if (patch.status)
        return `${label(doc, u)}: "${name}" → ${statusLabel(doc, 'taskStatuses', patch.status)}`
      if (patch.start !== undefined || patch.end !== undefined)
        return `${label(doc, u)}: "${name}" dates changed`
      return `${label(doc, u)}: edit "${name}"`
    },
    (u, d) => {
      const t = u.tasks.find((x) => x.id === taskId)
      if (!t) return
      if (patch.status && patch.status !== t.status)
        log(
          u,
          `"${t.name}": ${statusLabel(d as TrackerDoc, 'taskStatuses', t.status)} → ${statusLabel(d as TrackerDoc, 'taskStatuses', patch.status)}`,
        )
      const datesTouched = patch.start !== undefined || patch.end !== undefined
      Object.assign(t, patch)
      if (datesTouched) {
        t.datesManuallySet = patch.datesManuallySet ?? true
        // keep start <= end; a milestone is a single day
        if (t.start && (!t.end || t.end < t.start)) t.end = t.start
        if (t.end && !t.start) t.start = t.end
        if (t.kind === 'milestone') t.end = t.start
      }
      if (patch.kind === 'milestone') t.end = t.start
      t.updatedAt = new Date().toISOString()
    },
  )
}

export function addTask(id: string, phase: Phase): string {
  const taskId = newId('tsk')
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: add task in ${phase}`,
    (u, d) => {
      const sorted = [...u.tasks].sort((a, b) => a.order - b.order)
      const lastInPhase = [...sorted].reverse().find((t) => t.phase === phase)
      const ref = lastInPhase?.end ?? lastInPhase?.start ?? u.windows.dev.start.slice(0, 10)
      const insertAt = lastInPhase ? sorted.indexOf(lastInPhase) + 1 : sorted.length
      const task: Task = {
        id: taskId,
        templateStepId: null,
        name: 'New task',
        phase,
        kind: 'task',
        owner: d.settings.owners[0] ?? '',
        assignee: d.settings.assignees[0] ?? '',
        status:
          firstStatusOf(
            d.settings.taskStatuses as TrackerDoc['settings']['taskStatuses'],
            'planned',
          )?.id ?? 'ts-not-started',
        start: ref,
        end: ref,
        time: null,
        datesManuallySet: true,
        notes: '',
        link: '',
        order: insertAt,
        updatedAt: new Date().toISOString(),
      }
      sorted.splice(insertAt, 0, task as Draft<Task>)
      sorted.forEach((t, i) => (t.order = i))
      u.tasks = sorted
      log(u, `Task added in ${phase}`)
    },
  )
  return taskId
}

export function deleteTask(id: string, taskId: string) {
  editUpgrade(
    id,
    (doc, u) =>
      `${label(doc, u)}: delete "${u.tasks.find((t) => t.id === taskId)?.name ?? 'task'}"`,
    (u) => {
      const t = u.tasks.find((x) => x.id === taskId)
      if (t) log(u, `Task deleted: "${t.name}"`)
      u.tasks = u.tasks.filter((x) => x.id !== taskId)
      u.tasks.sort((a, b) => a.order - b.order).forEach((x, i) => (x.order = i))
    },
  )
}

export function reorderTask(id: string, activeId: string, overId: string) {
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: reorder tasks`,
    (u) => {
      u.tasks = moveTask(u.tasks as Task[], activeId, overId)
    },
  )
}

export function recalculate(
  id: string,
  overwriteManual: boolean,
): { changed: number; skipped: number } {
  const doc = st().doc
  const u = doc.upgrades.find((x) => x.id === id)
  if (!u) return { changed: 0, skipped: 0 }
  const res = recalculateTasks(u, doc.template, doc.settings, overwriteManual)
  if (res.changed === 0) return { changed: 0, skipped: res.skippedManual }
  editUpgrade(
    id,
    (d, x) => `${label(d, x)}: recalculate dates from windows`,
    (du) => {
      du.tasks = res.tasks
      log(
        du,
        `Dates recalculated from the windows (${res.changed} task(s)${res.skippedManual ? `, ${res.skippedManual} manual kept` : ''})`,
      )
    },
  )
  return { changed: res.changed, skipped: res.skippedManual }
}

export function shiftDates(id: string, days: number, includeWindows: boolean) {
  if (days === 0) return
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: shift all dates by ${days > 0 ? '+' : ''}${days} day(s)`,
    (u) => {
      const next = shiftUpgrade(u as Upgrade, days, includeWindows)
      u.windows = next.windows
      u.tasks = next.tasks
      log(
        u,
        `All ${includeWindows ? 'windows and task ' : 'task '}dates shifted by ${days > 0 ? '+' : ''}${days} day(s)`,
      )
    },
  )
}

export function applyTemplateToUpgrade(id: string): { added: number; detached: number } {
  const doc = st().doc
  const u = doc.upgrades.find((x) => x.id === id)
  if (!u) return { added: 0, detached: 0 }
  const res = applyTemplate(u, doc.template, doc.settings)
  editUpgrade(
    id,
    (d, x) => `${label(d, x)}: apply current template`,
    (du) => {
      du.tasks = res.tasks
      log(
        du,
        `Current template applied (${res.added} new step(s)${res.detached ? `, ${res.detached} kept as custom` : ''})`,
      )
    },
  )
  return res
}

export function duplicateUpgrade(
  id: string,
  opts: { family: string; cycle: string; shiftDays: number },
): string | null {
  const doc = st().doc
  const u = doc.upgrades.find((x) => x.id === id)
  if (!u) return null
  const copy = duplicateForNextCycle(u, opts, doc.template, doc.settings)
  st().commit(`${label(doc, copy)}: duplicated for ${copy.cycle}`, (d) => {
    d.upgrades.push(copy)
  })
  return copy.id
}

export function deleteUpgrade(id: string) {
  const doc = st().doc
  const u = doc.upgrades.find((x) => x.id === id)
  if (!u) return
  st().commit(`${label(doc, u)}: upgrade deleted`, (d) => {
    d.upgrades = d.upgrades.filter((x) => x.id !== id)
  })
}

export function addNote(id: string, text: string) {
  const clean = text.trim()
  if (!clean) return
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: note added`,
    (u) => log(u, clean, 'note'),
  )
}

export function deleteLogEntry(id: string, at: string, text: string) {
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: note removed`,
    (u) => {
      u.log = u.log.filter((e) => !(e.at === at && e.text === text))
    },
  )
}

export function saveCanvasPositions(
  id: string,
  positions: Record<string, { x: number; y: number }> | undefined,
) {
  editUpgrade(
    id,
    (doc, u) => `${label(doc, u)}: canvas layout`,
    (u) => {
      u.canvas.nodePositions = positions
    },
  )
}

// --- template ------------------------------------------------------------------

export function updateStep(stepId: string, patch: Partial<Omit<TemplateStep, 'id'>>) {
  const step = st().doc.template.steps.find((s) => s.id === stepId)
  st().commit(`Template: edit "${patch.name ?? step?.name ?? stepId}"`, (d) => {
    const s = d.template.steps.find((x) => x.id === stepId)
    if (!s) return
    Object.assign(s, patch)
    if (s.kind === 'milestone') s.durationDays = 1
    if (s.timeMode !== 'fixed') s.fixedTime = null
    else if (!s.fixedTime) s.fixedTime = '10:00'
  })
}

export function addStep(afterId?: string): string {
  const id = newId('step')
  st().commit('Template: add step', (d) => {
    const steps = d.template.steps
    const i = afterId ? steps.findIndex((s) => s.id === afterId) : steps.length - 1
    const ref = steps[i]
    steps.splice(i + 1, 0, {
      id,
      name: 'New step',
      phase: ref?.phase ?? 'Preparation',
      defaultOwner: ref?.defaultOwner ?? d.settings.owners[0] ?? 'P4M',
      defaultAssignee: ref?.defaultAssignee ?? d.settings.assignees[0] ?? 'MS team',
      anchor: ref?.anchor ?? 'dev',
      offsetDays: ref?.offsetDays ?? 0,
      durationDays: 1,
      kind: 'task',
      avoidWeekend: true,
      timeMode: 'none',
      fixedTime: null,
    })
  })
  return id
}

export function deleteStep(stepId: string) {
  const step = st().doc.template.steps.find((s) => s.id === stepId)
  st().commit(`Template: delete "${step?.name ?? stepId}"`, (d) => {
    d.template.steps = d.template.steps.filter((s) => s.id !== stepId)
  })
}

export function moveStep(activeId: string, overId: string) {
  st().commit('Template: reorder steps', (d) => {
    const steps = d.template.steps
    const from = steps.findIndex((s) => s.id === activeId)
    const to = steps.findIndex((s) => s.id === overId)
    if (from < 0 || to < 0) return
    const [item] = steps.splice(from, 1)
    if (item) steps.splice(to, 0, item)
  })
}

export function resetTemplate() {
  st().commit('Template: reset to the standard 24 steps', (d) => {
    d.template = defaultTemplate()
  })
}

// --- customers -----------------------------------------------------------------

export function deleteCustomer(id: string): boolean {
  const doc = st().doc
  if (doc.upgrades.some((u) => u.customerId === id)) return false
  const c = doc.customers.find((x) => x.id === id)
  st().commit(`Delete customer ${c?.name ?? id}`, (d) => {
    d.customers = d.customers.filter((x) => x.id !== id)
  })
  return true
}

/**
 * Move a window by N days (timeline drag). Optionally shift the tasks anchored on
 * that window by the same amount, keeping their relative spacing (and manual tweaks).
 */
export function moveWindow(id: string, env: EnvKey, days: number, shiftDependents: boolean) {
  if (days === 0) return
  editUpgrade(
    id,
    (doc, u) =>
      `${label(doc, u)}: ${ENV_LABEL[env]} window moved ${days > 0 ? '+' : ''}${days} day(s)${shiftDependents ? ' with its tasks' : ''}`,
    (u, d) => {
      const w = u.windows[env]
      if (!w) return
      const from = w.start
      const stamp = new Date().toISOString()
      w.start = `${addDaysIso(w.start.slice(0, 10), days)}${w.start.slice(10)}`
      w.updatedAt = stamp
      let shifted = 0
      if (shiftDependents) {
        const anchor = new Map(d.template.steps.map((s) => [s.id, s.anchor]))
        for (const t of u.tasks) {
          if (!t.templateStepId || anchor.get(t.templateStepId) !== env) continue
          if (t.start) t.start = addDaysIso(t.start, days)
          if (t.end) t.end = addDaysIso(t.end, days)
          if (t.start || t.end) {
            t.updatedAt = stamp
            shifted++
          }
        }
      }
      log(
        u,
        `${ENV_LABEL[env]} window moved: ${formatDay(from.slice(0, 10))} → ${formatDay(w.start.slice(0, 10))}${shiftDependents ? ` (${shifted} task(s) moved too)` : ''}`,
      )
    },
  )
}

/** Auto-layout: forget dragged canvas positions for these upgrades (one undo step). */
export function resetCanvasPositions(ids: string[]) {
  const targets = st().doc.upgrades.filter((u) => ids.includes(u.id) && u.canvas.nodePositions)
  if (targets.length === 0) return
  st().commit(`Canvas: auto-layout ${targets.length} lane(s)`, (d) => {
    for (const u of d.upgrades) if (ids.includes(u.id)) u.canvas.nodePositions = undefined
  })
}
