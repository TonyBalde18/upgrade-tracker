/**
 * What is happening when: overdue / blocked tasks, a day-by-day agenda, the next
 * upgrade window and a 30-day activity heat strip. Pure functions over the document.
 */
import { addDaysIso, diffDaysIso, zonedToInstant } from '@/lib/dates'
import type {
  EnvKey,
  Settings,
  StatusCategory,
  Task,
  TrackerDoc,
  Upgrade,
  UpgradeWindow,
} from '@/lib/model/types'
import { statusCategory } from '@/lib/template/schedule'
import { allWindows, isActiveUpgrade } from '@/lib/upgrade/logic'
import { windowPosition } from '@/lib/timeline'

type Doc = Pick<TrackerDoc, 'upgrades' | 'settings'>

const OPEN: (StatusCategory | undefined)[] = [
  'planned',
  'confirmed',
  'active',
  'blocked',
  undefined,
]

function liveUpgrades(doc: Doc): Upgrade[] {
  return doc.upgrades.filter((u) => isActiveUpgrade(u, doc.settings))
}

export function isOpenTask(t: Task, settings: Pick<Settings, 'taskStatuses'>): boolean {
  return OPEN.includes(statusCategory(settings.taskStatuses, t.status))
}

export const GO_NO_GO = /go\s*\/\s*no[-\s]?go/i
export const CALL = /\bcall\b/i

export interface TaskRef {
  upgrade: Upgrade
  task: Task
}

/** Open tasks whose end date is before today, most late first. */
export function overdueTasks(doc: Doc, today: string): (TaskRef & { daysLate: number })[] {
  return liveUpgrades(doc)
    .flatMap((upgrade) =>
      upgrade.tasks
        .filter((t) => t.end && t.end < today && isOpenTask(t, doc.settings))
        .map((task) => ({ upgrade, task, daysLate: diffDaysIso(today, task.end!) })),
    )
    .sort((a, b) => b.daysLate - a.daysLate)
}

export function blockedTasks(doc: Doc): TaskRef[] {
  return liveUpgrades(doc).flatMap((upgrade) =>
    upgrade.tasks
      .filter((t) => statusCategory(doc.settings.taskStatuses, t.status) === 'blocked')
      .map((task) => ({ upgrade, task })),
  )
}

export type AgendaKind = 'window' | 'call' | 'start' | 'due' | 'day'

export interface AgendaItem {
  key: string
  date: string
  /** "HH:mm" for sorting; windows and timed tasks */
  time: string | null
  kind: AgendaKind
  upgrade: Upgrade
  task?: Task
  env?: EnvKey
  /** windows: "dev" | "uat" | "prod" | "x:<id>" */
  windowKey?: string
}

/**
 * Agenda between two dates (inclusive), in the display time zone.
 *  - windows on their (converted) date
 *  - calls (milestones named "... call") on their day
 *  - single-day tasks on their day; multi-day tasks on their start ("start") and end ("due")
 * Done / N/A tasks are included so they can be toggled back, but windows of
 * cancelled upgrades are not.
 */
export function agenda(doc: Doc, from: string, to: string): AgendaItem[] {
  const items: AgendaItem[] = []
  const inRange = (d: string | null) => !!d && d >= from && d <= to
  for (const upgrade of liveUpgrades(doc)) {
    for (const nw of allWindows(upgrade)) {
      const w = nw.window
      if (statusCategory(doc.settings.windowStatuses, w.status) === 'cancelled') continue
      const pos = windowPosition(w, doc.settings.displayTimeZone)
      if (inRange(pos.date))
        items.push({
          key: `${upgrade.id}:w:${nw.key}`,
          date: pos.date,
          time: pos.local.slice(11, 16),
          kind: 'window',
          upgrade,
          env: nw.env ?? undefined,
          windowKey: nw.key,
        })
    }
    for (const task of upgrade.tasks) {
      if (statusCategory(doc.settings.taskStatuses, task.status) === 'na' || !task.start) continue
      const end = task.end ?? task.start
      const time = task.time?.start ?? null
      if (task.kind === 'milestone' || task.start === end) {
        if (inRange(task.start))
          items.push({
            key: `${upgrade.id}:${task.id}`,
            date: task.start,
            time,
            kind: CALL.test(task.name) ? 'call' : 'day',
            upgrade,
            task,
          })
        continue
      }
      if (inRange(task.start))
        items.push({
          key: `${upgrade.id}:${task.id}:s`,
          date: task.start,
          time,
          kind: 'start',
          upgrade,
          task,
        })
      if (inRange(end))
        items.push({
          key: `${upgrade.id}:${task.id}:e`,
          date: end,
          time: null,
          kind: 'due',
          upgrade,
          task,
        })
    }
  }
  const rank: Record<AgendaKind, number> = { window: 0, call: 1, day: 2, start: 3, due: 4 }
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '99').localeCompare(b.time ?? '99') ||
      rank[a.kind] - rank[b.kind],
  )
}

export function groupByDay(items: AgendaItem[]): { date: string; items: AgendaItem[] }[] {
  const out: { date: string; items: AgendaItem[] }[] = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (last && last.date === it.date) last.items.push(it)
    else out.push({ date: it.date, items: [it] })
  }
  return out
}

/** The next window that has not started yet (or is running now). */
export interface NextWindow {
  upgrade: Upgrade
  env: EnvKey | null
  /** "dev" | "uat" | "prod" | "x:<id>" */
  key: string
  window: UpgradeWindow
  start: Date
  end: Date
}

export function nextWindow(doc: Doc, now: Date): NextWindow | null {
  let best: NextWindow | null = null
  for (const upgrade of liveUpgrades(doc)) {
    for (const { env, key, window: w } of allWindows(upgrade)) {
      const cat = statusCategory(doc.settings.windowStatuses, w.status)
      if (cat === 'done' || cat === 'cancelled') continue
      let start: Date
      try {
        start = zonedToInstant(w.start, w.timeZone)
      } catch {
        continue
      }
      const end = new Date(start.getTime() + w.durationHours * 3_600_000)
      if (end <= now) continue
      if (!best || start < best.start) best = { upgrade, env, key, window: w, start, end }
    }
  }
  return best
}

/** Upcoming Go / No-Go calls within N days. */
export function upcomingGoNoGo(doc: Doc, today: string, days = 21): TaskRef[] {
  const to = addDaysIso(today, days)
  return liveUpgrades(doc)
    .flatMap((upgrade) =>
      upgrade.tasks
        .filter(
          (t) =>
            GO_NO_GO.test(t.name) &&
            t.start &&
            t.start >= today &&
            t.start <= to &&
            isOpenTask(t, doc.settings),
        )
        .map((task) => ({ upgrade, task })),
    )
    .sort((a, b) => a.task.start!.localeCompare(b.task.start!))
}

export interface HeatDay {
  date: string
  tasks: number
  windows: { upgrade: Upgrade; env: EnvKey | null; key: string }[]
  /** 0..1 */
  level: number
}

/** Activity per day for the next N days: open tasks running that day + windows (weighted). */
export function activityHeat(doc: Doc, today: string, days = 30): HeatDay[] {
  const out: HeatDay[] = Array.from({ length: days }, (_, i) => ({
    date: addDaysIso(today, i),
    tasks: 0,
    windows: [],
    level: 0,
  }))
  const end = addDaysIso(today, days - 1)
  for (const upgrade of liveUpgrades(doc)) {
    for (const t of upgrade.tasks) {
      if (!t.start || !isOpenTask(t, doc.settings)) continue
      const tEnd = t.end ?? t.start
      if (tEnd < today || t.start > end) continue
      const a = Math.max(0, diffDaysIso(t.start, today))
      const b = Math.min(days - 1, diffDaysIso(tEnd, today))
      for (let i = a; i <= b; i++) out[i]!.tasks++
    }
    for (const { env, key, window: w } of allWindows(upgrade)) {
      if (statusCategory(doc.settings.windowStatuses, w.status) === 'cancelled') continue
      const i = diffDaysIso(windowPosition(w, doc.settings.displayTimeZone).date, today)
      if (i >= 0 && i < days) out[i]!.windows.push({ upgrade, env, key })
    }
  }
  const score = (d: HeatDay) => d.tasks + d.windows.length * 4
  const max = Math.max(1, ...out.map(score))
  for (const d of out) d.level = score(d) / max
  return out
}

/** The next open tasks of an upgrade (by start date). */
export function nextTasks(u: Upgrade, settings: Pick<Settings, 'taskStatuses'>, n = 3): Task[] {
  return u.tasks
    .filter((t) => t.start && isOpenTask(t, settings))
    .sort((a, b) => a.start!.localeCompare(b.start!) || a.order - b.order)
    .slice(0, n)
}
