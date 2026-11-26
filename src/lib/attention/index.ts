/**
 * "Needs attention" list for the dashboard and the data behind its charts.
 * Pure functions over the document, so they can be unit tested.
 */
import { addDaysIso, diffDaysIso, formatDay } from '@/lib/dates'
import type { StatusDef, TrackerDoc, Upgrade } from '@/lib/model/types'
import { statusCategory } from '@/lib/template/schedule'
import { allWindows, isActiveUpgrade, windowName } from '@/lib/upgrade/logic'
import { weekendWindows, windowClashes, windowPosition } from '@/lib/timeline'
import { blockedTasks, isOpenTask, overdueTasks } from '@/lib/agenda'

export type AttentionLevel = 'high' | 'medium' | 'low'

export interface AttentionItem {
  key: string
  level: AttentionLevel
  title: string
  detail?: string
  /** route to open */
  to: string
}

type Doc = Pick<TrackerDoc, 'upgrades' | 'settings' | 'customers'>

const RANK: Record<AttentionLevel, number> = { high: 0, medium: 1, low: 2 }
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function attentionItems(doc: Doc, today: string): AttentionItem[] {
  const { settings } = doc
  const customer = (id: string) => doc.customers.find((c) => c.id === id)
  const name = (u: Upgrade) => customer(u.customerId)?.name ?? 'Unknown customer'
  const live = doc.upgrades.filter((u) => isActiveUpgrade(u, settings))
  const items: AttentionItem[] = []

  // overdue and blocked steps, one line per upgrade
  const perUpgrade = <T extends { upgrade: Upgrade }>(list: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of list) m.set(x.upgrade.id, [...(m.get(x.upgrade.id) ?? []), x])
    return [...m.values()]
  }
  for (const group of perUpgrade(overdueTasks(doc, today))) {
    const u = group[0]!.upgrade
    items.push({
      key: `overdue:${u.id}`,
      level: 'high',
      title: `${name(u)}: ${plural(group.length, 'step')} overdue`,
      detail: group
        .slice(0, 2)
        .map((g) => g.task.name)
        .join(', '),
      to: `/upgrades/${u.id}?task=${group[0]!.task.id}`,
    })
  }
  for (const group of perUpgrade(blockedTasks(doc))) {
    const u = group[0]!.upgrade
    items.push({
      key: `blocked:${u.id}`,
      level: 'high',
      title: `${name(u)}: ${plural(group.length, 'step')} blocked`,
      detail: group
        .slice(0, 2)
        .map((g) => g.task.name)
        .join(', '),
      to: `/upgrades/${u.id}?task=${group[0]!.task.id}`,
    })
  }

  // windows of two customers on the same night (from today on)
  for (const c of windowClashes(live, settings)) {
    if (c.key < addDaysIso(today, -1)) continue
    const parts = c.entries.map((e) => {
      const u = doc.upgrades.find((x) => x.id === e.upgradeId)!
      return `${customer(e.customerId)?.name ?? '?'} ${windowName(u, e.key, customer(e.customerId))}`
    })
    items.push({
      key: `clash:${c.key}`,
      level: 'high',
      title: `Same night: ${parts.join(' and ')}`,
      detail: `Night of ${formatDay(c.key, 'EEE d MMM')}`,
      to: '/timeline',
    })
  }

  const soon = addDaysIso(today, 3)
  for (const u of live) {
    // steps due in the next 3 days
    const due = u.tasks.filter(
      (t) => t.end && t.end >= today && t.end <= soon && isOpenTask(t, settings),
    )
    if (due.length)
      items.push({
        key: `due:${u.id}`,
        level: 'medium',
        title: `${name(u)}: ${plural(due.length, 'step')} due in the next 3 days`,
        detail: due
          .slice(0, 2)
          .map((t) => t.name)
          .join(', '),
        to: `/upgrades/${u.id}?task=${due[0]!.id}`,
      })

    const c = customer(u.customerId)
    const windows = allWindows(u, c)
    // Go / No-Go still open shortly before a window
    for (const nw of windows) {
      const cat = statusCategory(settings.windowStatuses, nw.window.status)
      if (cat === 'done' || cat === 'cancelled' || nw.window.goNoGo.decision !== 'pending') continue
      const d = diffDaysIso(windowPosition(nw.window, settings.displayTimeZone).date, today)
      if (d >= 0 && d <= 3)
        items.push({
          key: `gonogo:${u.id}:${nw.key}`,
          level: 'medium',
          title: `${name(u)}: no Go / No-Go yet for ${nw.label}`,
          detail: d === 0 ? 'Window today' : `Window in ${plural(d, 'day')}`,
          to: `/upgrades/${u.id}`,
        })
    }

    // not approved yet, but the first window is close
    if (statusCategory(settings.scheduleStatuses, u.scheduleStatus) === 'planned') {
      const first = windows[0]
      const d = first
        ? diffDaysIso(windowPosition(first.window, settings.displayTimeZone).date, today)
        : 99
      if (d >= 0 && d <= 14)
        items.push({
          key: `approval:${u.id}`,
          level: 'medium',
          title: `${name(u)}: not approved yet`,
          detail: `${first!.label} window in ${plural(d, 'day')}`,
          to: `/upgrades/${u.id}`,
        })
    }

    if (!u.snCaseUrl.trim())
      items.push({
        key: `case:${u.id}`,
        level: 'low',
        title: `${name(u)}: no ServiceNow case link`,
        to: `/upgrades/${u.id}`,
      })
  }

  // weekend windows in the next 60 days
  const horizon = addDaysIso(today, 60)
  for (const e of weekendWindows(live, settings, today)) {
    if (e.local.slice(0, 10) > horizon) continue
    const u = doc.upgrades.find((x) => x.id === e.upgradeId)!
    items.push({
      key: `weekend:${e.upgradeId}:${e.key}`,
      level: 'low',
      title: `${name(u)}: ${windowName(u, e.key, customer(u.customerId))} window on a weekend`,
      detail: formatDay(e.local.slice(0, 10), 'EEEE d MMM'),
      to: `/upgrades/${u.id}`,
    })
  }

  // release info of customers with an active upgrade not checked for 3 months
  for (const id of new Set(live.map((u) => u.customerId))) {
    const c = customer(id)
    if (!c) continue
    if (c.releaseCheckedAt && diffDaysIso(today, c.releaseCheckedAt) <= 92) continue
    items.push({
      key: `release:${id}`,
      level: 'low',
      title: `${c.name}: check the current release and patch`,
      detail: c.releaseCheckedAt
        ? `Last checked ${formatDay(c.releaseCheckedAt)}`
        : 'Never checked',
      to: `/customers/${id}`,
    })
  }

  return items.sort((a, b) => RANK[a.level] - RANK[b.level])
}

// --- charts ----------------------------------------------------------------------

export interface MonthBar {
  /** "2026-11" */
  month: string
  /** count per schedule status id, in the order of settings.scheduleStatuses */
  counts: { status: StatusDef; count: number }[]
  total: number
}

/**
 * Upgrades per month (by their PROD window date) from `before` months ago to
 * `after` months ahead, split by schedule status. Cancelled upgrades are left out.
 */
export function upgradesPerMonth(
  doc: Pick<TrackerDoc, 'upgrades' | 'settings'>,
  today: string,
  before = 2,
  after = 9,
): MonthBar[] {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const months: string[] = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const statuses = doc.settings.scheduleStatuses.filter((s) => s.category !== 'cancelled')
  return months.map((month) => {
    const here = doc.upgrades.filter((u) => u.windows.prod.start.slice(0, 7) === month)
    const counts = statuses.map((status) => ({
      status,
      count: here.filter((u) => u.scheduleStatus === status.id).length,
    }))
    return { month, counts, total: counts.reduce((s, c) => s + c.count, 0) }
  })
}
