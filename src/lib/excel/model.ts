/**
 * What goes into an exported Excel plan, independent of the Excel library: the same
 * layout as the customer schedules the team already shares (steps with owner,
 * assignee and status, then one column per day with coloured, labelled cells).
 * Everything here is pure and unit-tested; render.ts turns it into a workbook.
 */
import {
  addDaysIso,
  compareIso,
  formatInZone,
  isWeekend,
  weekdayOf,
  zoneAbbr,
  zonedToInstant,
} from '@/lib/dates'
import { allWindows, envLabel, phaseLabel } from '@/lib/upgrade/logic'
import { progressOf, statusCategory } from '@/lib/template/schedule'
import { releaseLogoOf } from '@/lib/releases'
import {
  PHASES,
  type Customer,
  type GoNoGo,
  type Phase,
  type StatusCategory,
  type Task,
  type TrackerDoc,
  type Upgrade,
  type UpgradeWindow,
} from '@/lib/model/types'

/** Cell colours (ARGB) per status category. Green matches the original schedules. */
export const CATEGORY_FILL: Record<StatusCategory, { fill: string; font: string } | null> = {
  done: { fill: 'FF00B050', font: 'FFFFFFFF' },
  active: { fill: 'FF8B5CF6', font: 'FFFFFFFF' },
  confirmed: { fill: 'FFBDD7EE', font: 'FF1F3864' },
  planned: { fill: 'FFD9E1F2', font: 'FF1F3864' },
  blocked: { fill: 'FFE1292C', font: 'FFFFFFFF' },
  cancelled: { fill: 'FFD9D9D9', font: 'FF595959' },
  na: null,
}

export const LEGEND: { category: StatusCategory; label: string }[] = [
  { category: 'done', label: 'Completed' },
  { category: 'active', label: 'In progress' },
  { category: 'planned', label: 'Not started' },
  { category: 'blocked', label: 'Blocked' },
]

/** Short text shown on the day cells of a step, like the hand-made schedules. */
export function cellLabel(task: Pick<Task, 'name' | 'kind'>, multiDay: boolean): string {
  const n = task.name.trim()
  const freeze = /freeze on (.+?)(?: instance| period|$)/i.exec(n)
  if (freeze) return `${freeze[1]!.replace(/\s*\(.*\)\s*/g, '').trim()} Freeze`
  if (/freeze/i.test(n)) return 'Freeze'
  if (/^upgrade\s+.+\s+to\s+/i.test(n)) return 'UP'
  if (/clone/i.test(n)) return 'CL'
  if (/user acceptance/i.test(n)) return 'UAT'
  if (/smoke/i.test(n)) return 'Smoke testing'
  if (/hypercare/i.test(n)) return 'Hypercare'
  if (/go\s*(or|\/)\s*no[\s-]*go/i.test(n)) return 'Go/No-Go'
  if (/alignment call/i.test(n)) return 'Call'
  return multiDay ? n : '•'
}

export interface DayColumn {
  date: string
  weekend: boolean
  today: boolean
}

export interface PlanRowCells {
  /** index into `days` */
  from: number
  to: number
  label: string
  category: StatusCategory
}

export type PlanRow =
  | { kind: 'phase'; phase: Phase; label: string }
  | {
      kind: 'task'
      name: string
      assignedTo: string
      owner: string
      assignee: string
      status: string
      category: StatusCategory
      start: string | null
      end: string | null
      cells: PlanRowCells | null
    }

export interface PlanModel {
  customer: Pick<Customer, 'name' | 'shortName' | 'logo'>
  title: string
  subtitle: string
  windows: { env: string; text: string; goNoGo: string }[]
  fromFamily: string
  family: string
  fromLogo?: string
  toLogo?: string
  days: DayColumn[]
  rows: PlanRow[]
  fileName: string
  sheetName: string
}

/** "Mon 23 Nov 2026, 00:15-03:15 CET (Europe/Zurich)" */
export function windowText(w: UpgradeWindow): string {
  const start = zonedToInstant(w.start, w.timeZone)
  const end = new Date(start.getTime() + w.durationHours * 3_600_000)
  const day = formatInZone(start, w.timeZone, 'EEE d MMM yyyy')
  return `${day}, ${formatInZone(start, w.timeZone, 'HH:mm')}-${formatInZone(end, w.timeZone, 'HH:mm')} ${zoneAbbr(w.timeZone, start)} (${w.timeZone})`
}

/** "Go (12 Nov 2026, SDM)", "No-Go", "Pending" */
export function goNoGoText(g: GoNoGo): string {
  if (g.decision === 'pending') return 'Pending'
  const extra = [g.date ? formatDayShort(g.date) : '', g.by].filter(Boolean).join(', ')
  return `${g.decision === 'go' ? 'Go' : 'No-Go'}${extra ? ` (${extra})` : ''}`
}

function formatDayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][(m ?? 1) - 1]
  return `${d} ${month} ${y}`
}

/** Monday on or before / Sunday on or after. */
const mondayOf = (iso: string) => addDaysIso(iso, -((weekdayOf(iso) + 6) % 7))
const sundayOf = (iso: string) => addDaysIso(mondayOf(iso), 6)

export function dayColumns(tasks: Pick<Task, 'start' | 'end'>[], today: string): DayColumn[] {
  const dated = tasks.filter((t) => t.start)
  if (dated.length === 0) return []
  let first = dated[0]!.start!
  let last = dated[0]!.end ?? first
  for (const t of dated) {
    if (compareIso(t.start!, first) < 0) first = t.start!
    const e = t.end ?? t.start!
    if (compareIso(e, last) > 0) last = e
  }
  const days: DayColumn[] = []
  for (let d = mondayOf(first); compareIso(d, sundayOf(last)) <= 0; d = addDaysIso(d, 1))
    days.push({ date: d, weekend: isWeekend(d), today: d === today })
  return days
}

/** Excel sheet names: max 31 characters, none of : \ / ? * [ ] */
export function safeSheetName(name: string, taken: Set<string>): string {
  const base =
    name
      .replace(/[:\\/?*[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet'
  let candidate = base
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  taken.add(candidate.toLowerCase())
  return candidate
}

export function safeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function planModel(
  doc: Pick<TrackerDoc, 'customers' | 'settings'>,
  upgrade: Upgrade,
  today: string,
  takenSheetNames: Set<string> = new Set(),
): PlanModel {
  const found = doc.customers.find((c) => c.id === upgrade.customerId)
  const customer = found ?? {
    name: 'Unknown customer',
    shortName: '',
    logo: undefined,
  }
  const { settings } = doc
  const label = (list: 'taskStatuses' | 'scheduleStatuses', id: string) =>
    settings[list].find((s) => s.id === id)?.label ?? id
  const tasks = [...upgrade.tasks]
    .filter((t) => statusCategory(settings.taskStatuses, t.status) !== 'na')
    .sort((a, b) => a.order - b.order)
  const days = dayColumns(tasks, today)
  const index = new Map(days.map((d, i) => [d.date, i]))

  const rows: PlanRow[] = []
  for (const phase of PHASES) {
    const inPhase = tasks.filter((t) => t.phase === phase)
    if (inPhase.length === 0) continue
    rows.push({ kind: 'phase', phase, label: phaseLabel(phase, found) })
    for (const t of inPhase) {
      const category = statusCategory(settings.taskStatuses, t.status) ?? 'planned'
      const from = t.start ? index.get(t.start) : undefined
      const to = t.start ? index.get(t.end ?? t.start) : undefined
      rows.push({
        kind: 'task',
        name: t.name,
        assignedTo: t.assignedTo,
        owner: t.owner,
        assignee: t.assignee,
        status: label('taskStatuses', t.status),
        category,
        start: t.start,
        end: t.end ?? t.start,
        cells:
          from !== undefined && to !== undefined
            ? { from, to, label: cellLabel(t, to > from), category }
            : null,
      })
    }
  }

  const year = (upgrade.windows.prod.start || upgrade.createdAt).slice(0, 4)
  const progress = Math.round(progressOf(upgrade.tasks, settings.taskStatuses) * 100)
  return {
    customer,
    title: `${customer.name} - ${upgrade.fromFamily} to ${upgrade.family} upgrade schedule`,
    subtitle: `Cycle ${upgrade.cycle} · Status: ${label('scheduleStatuses', upgrade.scheduleStatus)} · ${progress}% complete`,
    windows: allWindows(upgrade, found).flatMap((nw) => {
      const line = {
        env: nw.label,
        text: windowText(nw.window),
        goNoGo: goNoGoText(nw.window.goNoGo),
      }
      // a skipped test environment is listed right after DEV
      return nw.env === 'dev' && !upgrade.windows.uat
        ? [line, { env: envLabel('uat', found), text: 'Not applicable', goNoGo: '' }]
        : [line]
    }),
    fromFamily: upgrade.fromFamily,
    family: upgrade.family,
    fromLogo: releaseLogoOf(settings, upgrade.fromFamily),
    toLogo: releaseLogoOf(settings, upgrade.family),
    days,
    rows,
    fileName: safeFileName(`${customer.name} - ${upgrade.family} Upgrade schedule ${year}.xlsx`),
    sheetName: safeSheetName(customer.shortName || customer.name, takenSheetNames),
  }
}

export interface OverviewRow {
  customer: string
  from: string
  to: string
  cycle: string
  status: string
  category: StatusCategory
  dev: string
  uat: string
  prod: string
  /** extra windows, one per line */
  other: string
  goNoGo: string
  progress: number
  nextStep: string
}

/** One line per upgrade, ordered by PROD date. */
export function overviewRows(
  doc: Pick<TrackerDoc, 'customers' | 'settings'>,
  upgrades: Upgrade[],
): OverviewRow[] {
  const { settings } = doc
  return [...upgrades]
    .sort((a, b) => a.windows.prod.start.localeCompare(b.windows.prod.start))
    .map((u) => {
      const c = doc.customers.find((x) => x.id === u.customerId)
      const open = [...u.tasks]
        .filter((t) => {
          const cat = statusCategory(settings.taskStatuses, t.status)
          return t.start && cat !== 'done' && cat !== 'na' && cat !== 'cancelled'
        })
        .sort((a, b) => a.start!.localeCompare(b.start!) || a.order - b.order)[0]
      const w = (env: 'dev' | 'uat' | 'prod') => {
        const x = u.windows[env]
        return `${envLabel(env, c)}: ${x ? windowText(x) : 'N/A'}`
      }
      return {
        customer: c?.name ?? 'Unknown customer',
        from: u.fromFamily,
        to: u.family,
        cycle: u.cycle,
        status: settings.scheduleStatuses.find((s) => s.id === u.scheduleStatus)?.label ?? '',
        category: statusCategory(settings.scheduleStatuses, u.scheduleStatus) ?? 'planned',
        dev: w('dev'),
        uat: w('uat'),
        prod: w('prod'),
        other: u.extraWindows.map((x) => `${x.name}: ${windowText(x)}`).join('\n'),
        goNoGo: goNoGoText(u.windows.prod.goNoGo),
        progress: progressOf(u.tasks, settings.taskStatuses),
        nextStep: open ? `${open.name} (${open.start})` : 'All steps completed',
      }
    })
}
