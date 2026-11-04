/**
 * Pure helpers for the global timeline: phase spans, window positions and
 * PROD-window clashes between customers.
 */
import { addDaysIso, convertLocal, isoWeekOf } from '@/lib/dates'
import type {
  EnvKey,
  Phase,
  Settings,
  StatusCategory,
  Upgrade,
  UpgradeWindow,
} from '@/lib/model/types'
import { PHASES } from '@/lib/model/types'
import { statusCategory } from '@/lib/template/schedule'
import { addHoursToHHmm } from '@/lib/dates'

export interface PhaseSpan {
  phase: Phase
  start: string
  end: string
  /** done = every relevant task done; blocked = any blocked; active = any in progress */
  state: 'planned' | 'active' | 'done' | 'blocked'
  total: number
  done: number
}

/** One span per phase, from the first start to the last end of its applicable tasks. */
export function phaseSpans(
  u: Pick<Upgrade, 'tasks'>,
  settings: Pick<Settings, 'taskStatuses'>,
): PhaseSpan[] {
  const out: PhaseSpan[] = []
  for (const phase of PHASES) {
    const tasks = u.tasks.filter(
      (t) =>
        t.phase === phase && t.start && statusCategory(settings.taskStatuses, t.status) !== 'na',
    )
    if (tasks.length === 0) continue
    const cats = tasks.map((t) => statusCategory(settings.taskStatuses, t.status))
    const starts = tasks.map((t) => t.start!).sort()
    const ends = tasks.map((t) => t.end ?? t.start!).sort()
    const done = cats.filter((c) => c === 'done').length
    const state: PhaseSpan['state'] = cats.includes('blocked')
      ? 'blocked'
      : done === tasks.length
        ? 'done'
        : cats.some((c) => c === 'active' || c === 'done')
          ? 'active'
          : 'planned'
    out.push({
      phase,
      start: starts[0]!,
      end: ends[ends.length - 1]!,
      state,
      total: tasks.length,
      done,
    })
  }
  return out
}

/** Window start as seen in the display zone: date + fraction of the day (0..1). */
export function windowPosition(
  w: UpgradeWindow,
  displayTz: string,
): { date: string; fraction: number; local: string } {
  let local = w.start
  try {
    local = convertLocal(w.start, w.timeZone, displayTz)
  } catch {
    /* invalid zone: show as written */
  }
  const [h, m] = local.slice(11, 16).split(':').map(Number)
  return { date: local.slice(0, 10), fraction: ((h ?? 0) * 60 + (m ?? 0)) / 1440, local }
}

/**
 * The "night" of a window: windows from noon to noon belong to the same night, so a
 * 22:00 Monday window and a 00:15 Tuesday window are on the same night (Monday's).
 */
export function nightOf(localDateTime: string): string {
  const date = localDateTime.slice(0, 10)
  const hour = Number(localDateTime.slice(11, 13))
  return hour < 12 ? addDaysIso(date, -1) : date
}

export interface ProdEntry {
  upgradeId: string
  customerId: string
  local: string
  night: string
  week: string // Monday of the ISO week
}

export interface Clash {
  key: string // night date or week Monday
  kind: 'night' | 'week'
  entries: ProdEntry[]
}

/**
 * PROD windows of different customers on the same night (strong clash) or in the
 * same ISO week (softer). Cancelled upgrades / windows are ignored.
 */
export function prodClashes(
  upgrades: Upgrade[],
  settings: Pick<Settings, 'scheduleStatuses' | 'windowStatuses' | 'displayTimeZone'>,
): { nights: Clash[]; weeks: Clash[] } {
  const entries: ProdEntry[] = []
  for (const u of upgrades) {
    if (statusCategory(settings.scheduleStatuses, u.scheduleStatus) === 'cancelled') continue
    const w = u.windows.prod
    if (statusCategory(settings.windowStatuses, w.status) === 'cancelled') continue
    const pos = windowPosition(w, settings.displayTimeZone)
    const night = nightOf(pos.local)
    entries.push({
      upgradeId: u.id,
      customerId: u.customerId,
      local: pos.local,
      night,
      week: isoWeekOf(pos.date).monday,
    })
  }
  const group = (key: (e: ProdEntry) => string, kind: Clash['kind']): Clash[] => {
    const map = new Map<string, ProdEntry[]>()
    for (const e of entries) map.set(key(e), [...(map.get(key(e)) ?? []), e])
    return [...map.entries()]
      .filter(([, es]) => new Set(es.map((e) => e.customerId)).size >= 2)
      .map(([k, es]) => ({
        key: k,
        kind,
        entries: es.sort((a, b) => a.local.localeCompare(b.local)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }
  return { nights: group((e) => e.night, 'night'), weeks: group((e) => e.week, 'week') }
}

/** Overall state of an upgrade's window for markers. */
export function windowState(
  w: UpgradeWindow,
  settings: Pick<Settings, 'windowStatuses'>,
): StatusCategory | undefined {
  return statusCategory(settings.windowStatuses, w.status)
}

/** "00:15 to 03:15" */
export function windowTimeRange(w: UpgradeWindow): string {
  const start = w.start.slice(11, 16)
  return `${start} to ${addHoursToHHmm(start, w.durationHours)}`
}

/** Tasks that depend on a window (their template step is anchored on it). */
export function dependentTaskIds(
  u: Pick<Upgrade, 'tasks'>,
  anchorOf: Map<string, EnvKey>,
  env: EnvKey,
): string[] {
  return u.tasks
    .filter((t) => t.templateStepId && anchorOf.get(t.templateStepId) === env && t.start)
    .map((t) => t.id)
}
