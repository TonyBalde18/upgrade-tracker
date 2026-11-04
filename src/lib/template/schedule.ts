/**
 * Turns the standard template + an upgrade's windows into dated tasks.
 * Offsets are calendar days from the anchor window's local date.
 */
import { addDaysIso, addHoursToHHmm, avoidWeekend } from '@/lib/dates'
import { newId } from '@/lib/id'
import type {
  Settings,
  StatusCategory,
  StatusDef,
  Task,
  TaskTime,
  Template,
  TemplateStep,
  Upgrade,
  UpgradeWindow,
} from '@/lib/model/types'

export type Windows = Upgrade['windows']

export function firstStatusOf(list: StatusDef[], category: StatusCategory): StatusDef | undefined {
  return list.find((s) => s.category === category)
}

export function statusCategory(list: StatusDef[], id: string): StatusCategory | undefined {
  return list.find((s) => s.id === id)?.category
}

export function fillFamily(name: string, family: string): string {
  return name.replaceAll('{family}', family || '{family}')
}

export interface StepSchedule {
  start: string | null
  end: string | null
  time: TaskTime | null
  applicable: boolean
}

/** Dates for one step given the windows. Steps anchored on a missing window are not applicable. */
export function scheduleStep(step: TemplateStep, windows: Windows): StepSchedule {
  const win: UpgradeWindow | null = windows[step.anchor]
  if (!win) return { start: null, end: null, time: null, applicable: false }
  const anchorDate = win.start.slice(0, 10)
  let start = addDaysIso(anchorDate, step.offsetDays)
  if (step.avoidWeekend && step.offsetDays !== 0) {
    start = avoidWeekend(start, step.offsetDays < 0 ? -1 : 1)
  }
  const days = step.kind === 'milestone' ? 1 : Math.max(1, step.durationDays)
  const end = addDaysIso(start, days - 1)
  let time: TaskTime | null = null
  if (step.timeMode === 'window') {
    const hhmm = win.start.slice(11, 16)
    time = { start: hhmm, end: addHoursToHHmm(hhmm, win.durationHours), timeZone: win.timeZone }
  } else if (step.timeMode === 'fixed' && step.fixedTime) {
    time = { start: step.fixedTime, end: null, timeZone: win.timeZone }
  }
  return { start, end, time, applicable: true }
}

export interface GenerateOptions {
  template: Template
  windows: Windows
  family: string
  settings: Pick<Settings, 'taskStatuses'>
  now?: Date
}

/** Fresh task list for a new upgrade. */
export function generateTasks({
  template,
  windows,
  family,
  settings,
  now = new Date(),
}: GenerateOptions): Task[] {
  const planned = firstStatusOf(settings.taskStatuses, 'planned')?.id ?? 'ts-not-started'
  const na = firstStatusOf(settings.taskStatuses, 'na')?.id ?? 'ts-na'
  const stamp = now.toISOString()
  return template.steps.map((step, i) => {
    const s = scheduleStep(step, windows)
    return {
      id: newId('tsk'),
      templateStepId: step.id,
      name: fillFamily(step.name, family),
      phase: step.phase,
      kind: step.kind,
      owner: step.defaultOwner,
      assignee: step.defaultAssignee,
      status: s.applicable ? planned : na,
      start: s.start,
      end: s.end,
      time: s.time,
      datesManuallySet: false,
      notes: '',
      link: '',
      order: i,
      updatedAt: stamp,
    }
  })
}

export interface RecalcResult {
  tasks: Task[]
  changed: number
  skippedManual: number
}

/**
 * Re-apply template offsets to an existing upgrade's tasks.
 * Tasks without a template step keep their dates. Tasks with datesManuallySet are
 * only overwritten when `overwriteManual` is true.
 */
export function recalculateTasks(
  upgrade: Pick<Upgrade, 'tasks' | 'windows'>,
  template: Template,
  settings: Pick<Settings, 'taskStatuses'>,
  overwriteManual: boolean,
  now: Date = new Date(),
): RecalcResult {
  const stepsById = new Map(template.steps.map((s) => [s.id, s]))
  const planned = firstStatusOf(settings.taskStatuses, 'planned')?.id ?? 'ts-not-started'
  const na = firstStatusOf(settings.taskStatuses, 'na')?.id ?? 'ts-na'
  let changed = 0
  let skippedManual = 0
  const tasks = upgrade.tasks.map((t) => {
    const step = t.templateStepId ? stepsById.get(t.templateStepId) : undefined
    if (!step) return t
    if (t.datesManuallySet && !overwriteManual) {
      skippedManual++
      return t
    }
    const s = scheduleStep(step, upgrade.windows)
    const cat = statusCategory(settings.taskStatuses, t.status)
    let status = t.status
    if (!s.applicable) status = na
    else if (cat === 'na') status = planned
    const same =
      t.start === s.start &&
      t.end === s.end &&
      JSON.stringify(t.time) === JSON.stringify(s.time) &&
      status === t.status &&
      !t.datesManuallySet
    if (same) return t
    changed++
    return {
      ...t,
      start: s.start,
      end: s.end,
      time: s.time,
      status,
      datesManuallySet: false,
      updatedAt: now.toISOString(),
    }
  })
  return { tasks, changed, skippedManual }
}

/** Number of tasks that have manual dates and would be overwritten by a recalculation. */
export function countManual(tasks: Task[]): number {
  return tasks.filter((t) => t.datesManuallySet && t.templateStepId).length
}

/** Progress 0..1, ignoring N/A tasks. */
export function progressOf(tasks: Task[], statuses: StatusDef[]): number {
  const cat = new Map(statuses.map((s) => [s.id, s.category]))
  const relevant = tasks.filter((t) => cat.get(t.status) !== 'na')
  if (relevant.length === 0) return 0
  return relevant.filter((t) => cat.get(t.status) === 'done').length / relevant.length
}
