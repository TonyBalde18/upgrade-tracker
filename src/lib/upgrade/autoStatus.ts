/**
 * Automatic upgrade (schedule) status:
 *  - planned / confirmed -> active ("In progress") once the DEV window has started
 *  - active -> done once the PROD window has passed and every PROD and Hypercare
 *    step is completed (N/A steps ignored)
 * Each move happens at most once per upgrade: it leaves a marker in the activity
 * log, so a status you change back by hand is never overridden again.
 */
import { zonedToInstant } from '@/lib/dates'
import { firstStatusOf, statusCategory } from '@/lib/template/schedule'
import type { Settings, Upgrade } from '@/lib/model/types'

export const AUTO_STARTED = 'Status set automatically: DEV window started'
export const AUTO_DONE = 'Status set automatically: PROD and hypercare completed'

export interface AutoStatusChange {
  upgradeId: string
  statusId: string
  logText: string
}

const hasMarker = (u: Upgrade, text: string) => u.log.some((l) => l.text.startsWith(text))

export function autoStatusChanges(
  upgrades: Upgrade[],
  settings: Pick<Settings, 'scheduleStatuses' | 'taskStatuses'>,
  now: Date,
): AutoStatusChange[] {
  const active = firstStatusOf(settings.scheduleStatuses, 'active')
  const done = firstStatusOf(settings.scheduleStatuses, 'done')
  const out: AutoStatusChange[] = []
  for (const u of upgrades) {
    const cat = statusCategory(settings.scheduleStatuses, u.scheduleStatus)
    const devStart = zonedToInstant(u.windows.dev.start, u.windows.dev.timeZone)
    if (
      active &&
      (cat === 'planned' || cat === 'confirmed') &&
      devStart <= now &&
      !hasMarker(u, AUTO_STARTED)
    ) {
      out.push({ upgradeId: u.id, statusId: active.id, logText: AUTO_STARTED })
      continue
    }
    if (!done || cat !== 'active' || hasMarker(u, AUTO_DONE)) continue
    const prod = u.windows.prod
    const prodEnd = new Date(
      zonedToInstant(prod.start, prod.timeZone).getTime() + prod.durationHours * 3_600_000,
    )
    if (prodEnd > now) continue
    const closing = u.tasks.filter(
      (t) =>
        (t.phase === 'PROD' || t.phase === 'Hypercare') &&
        statusCategory(settings.taskStatuses, t.status) !== 'na',
    )
    if (
      closing.length > 0 &&
      closing.every((t) => statusCategory(settings.taskStatuses, t.status) === 'done')
    )
      out.push({ upgradeId: u.id, statusId: done.id, logText: AUTO_DONE })
  }
  return out
}
