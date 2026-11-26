/**
 * iCalendar (RFC 5545) export, tuned for Outlook on Windows.
 *  - CRLF line endings, lines folded at 75 octets (never inside a UTF-8 character)
 *  - TEXT values escaped (\\ ; , and newlines)
 *  - timed events in UTC (…Z), so no VTIMEZONE blocks are needed
 *  - all-day events with VALUE=DATE and an exclusive DTEND
 *  - stable UIDs (<upgradeId>-<taskId>@upgrade-tracker) and a SEQUENCE that grows
 *    every time the item changes, so re-importing updates instead of duplicating
 */
import { addDaysIso, addHoursToHHmm, zonedToInstant } from '@/lib/dates'
import type { Customer, Settings, Task, Template, Upgrade, UpgradeWindow } from '@/lib/model/types'
import { statusCategory } from '@/lib/template/schedule'
import { allWindows, windowOfTask } from '@/lib/upgrade/logic'

export type IcsScope = 'windows' | 'milestones' | 'all'

export const ICS_SCOPE_LABEL: Record<IcsScope, string> = {
  windows: 'Windows only',
  milestones: 'Windows + milestones',
  all: 'Everything',
}

const CRLF = '\r\n'
const SEQUENCE_EPOCH = Date.UTC(2024, 0, 1)

/** Escape a TEXT value. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Fold a content line at 75 octets; continuation lines start with one space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74 // the leading space counts
    }
    current += ch
    bytes += n
  }
  parts.push(current)
  return parts.join(`${CRLF} `)
}

function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, '')
}

/** Grows with every change of the item (minutes since 2024). */
export function sequenceOf(updatedAt: string): number {
  const t = Date.parse(updatedAt)
  return Number.isFinite(t) ? Math.max(0, Math.floor((t - SEQUENCE_EPOCH) / 60_000)) : 0
}

export function uidFor(upgradeId: string, itemId: string): string {
  return `${upgradeId}-${itemId}@upgrade-tracker`
}

interface VEvent {
  uid: string
  sequence: number
  summary: string
  description: string
  start: { date: string } | { instant: Date }
  end: { date: string } | { instant: Date }
  categories: string
  cancelled: boolean
  transparent: boolean
  url?: string
}

function eventLines(e: VEvent, stamp: Date): string[] {
  const dt = (name: string, v: VEvent['start']) =>
    'date' in v ? `${name};VALUE=DATE:${dateValue(v.date)}` : `${name}:${utcStamp(v.instant)}`
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `SEQUENCE:${e.sequence}`,
    dt('DTSTART', e.start),
    dt('DTEND', e.end),
    `SUMMARY:${escapeText(e.summary)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    `CATEGORIES:${escapeText(e.categories)}`,
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    `TRANSP:${e.transparent ? 'TRANSPARENT' : 'OPAQUE'}`,
  ]
  if (e.url) lines.push(`URL:${e.url}`)
  lines.push('END:VEVENT')
  return lines
}

export interface IcsInput {
  upgrades: Upgrade[]
  customers: Customer[]
  settings: Settings
  template: Template
  scope: IcsScope
  /** link back to the app, e.g. https://tonybalde18.github.io/upgrade-tracker/ */
  appUrl: string
  /** only items ending on or after this date (export "upcoming") */
  from?: string
  now?: Date
}

function describe(lines: (string | false | null | undefined)[]): string {
  return lines.filter(Boolean).join('\n')
}

/** Build the events for one or more upgrades. */
export function buildEvents(input: IcsInput): VEvent[] {
  const { upgrades, customers, settings, template, scope, appUrl, from } = input
  const events: VEvent[] = []
  for (const u of upgrades) {
    const c = customers.find((x) => x.id === u.customerId)
    const tag = `[${c?.name ?? 'Unknown customer'}]`
    const link = appUrl ? `${appUrl}#/upgrades/${u.id}` : ''
    const upgradeCancelled =
      statusCategory(settings.scheduleStatuses, u.scheduleStatus) === 'cancelled'
    const caseLine = u.snCaseUrl ? `ServiceNow case: ${u.snCaseUrl}` : null

    for (const nw of allWindows(u, c)) {
      const w: UpgradeWindow = nw.window
      // standard windows keep their old uid ("window-dev"), extra ones use their id
      const uidKey = nw.extra ? `window-x-${nw.extra.id}` : `window-${nw.key}`
      let start: Date
      try {
        start = zonedToInstant(w.start, w.timeZone)
      } catch {
        continue
      }
      const end = new Date(
        start.getTime() + (w.durationHours || settings.defaultWindowDurationHours || 3) * 3_600_000,
      )
      if (from && end.toISOString().slice(0, 10) < from) continue
      const status = settings.windowStatuses.find((s) => s.id === w.status)
      events.push({
        uid: uidFor(u.id, uidKey),
        sequence: sequenceOf(w.updatedAt),
        summary: `${tag} Upgrade ${nw.label} → ${u.family}`,
        description: describe([
          `${u.fromFamily} → ${u.family} (${u.cycle})`,
          `${nw.label} window: ${w.start.slice(0, 10)} ${w.start.slice(11)} to ${addHoursToHHmm(w.start.slice(11, 16), w.durationHours)} (${w.timeZone})`,
          `Status: ${status?.label ?? 'Unknown'}`,
          w.goNoGo.decision !== 'pending' &&
            `Go / No-Go: ${w.goNoGo.decision === 'go' ? 'Go' : 'No-Go'}${w.goNoGo.date ? ` (${w.goNoGo.date})` : ''}${w.goNoGo.by ? ` by ${w.goNoGo.by}` : ''}`,
          caseLine,
          link && `Open in Upgrade Tracker: ${link}`,
        ]),
        start: { instant: start },
        end: { instant: end },
        categories: `Upgrade window,${nw.label}`,
        cancelled:
          upgradeCancelled || statusCategory(settings.windowStatuses, w.status) === 'cancelled',
        transparent: false,
        url: link || undefined,
      })
    }

    if (scope === 'windows') continue
    for (const t of u.tasks) {
      if (!t.start) continue
      if (statusCategory(settings.taskStatuses, t.status) === 'na') continue
      if (scope === 'milestones' && t.kind !== 'milestone') continue
      // the "Upgrade DEV/UAT/PROD" steps are already exported as windows
      if (windowOfTask(u, template, t.id)) continue
      const endDate = t.end ?? t.start
      if (from && endDate < from) continue
      events.push(taskEvent(u, t, tag, link, caseLine, settings, upgradeCancelled))
    }
  }
  return events
}

function taskEvent(
  u: Upgrade,
  t: Task,
  tag: string,
  link: string,
  caseLine: string | null,
  settings: Settings,
  cancelled: boolean,
): VEvent {
  const status = settings.taskStatuses.find((s) => s.id === t.status)
  const description = describe([
    `${u.fromFamily} → ${u.family} (${u.cycle}) · ${t.phase}`,
    `Owner: ${t.owner}`,
    `Assignee: ${t.assignee}`,
    `Status: ${status?.label ?? 'Unknown'}`,
    t.notes && `Notes: ${t.notes}`,
    t.link && `Link: ${t.link}`,
    caseLine,
    link && `Open in Upgrade Tracker: ${link}`,
  ])
  const endDate = t.end ?? t.start!
  let start: VEvent['start'] = { date: t.start! }
  let end: VEvent['end'] = { date: addDaysIso(endDate, 1) }
  // single-day steps with a time of day become timed events (e.g. a 10:00 call)
  if (t.time && t.start === endDate) {
    try {
      const s = zonedToInstant(`${t.start}T${t.time.start}`, t.time.timeZone)
      let e = t.time.end
        ? zonedToInstant(`${t.start}T${t.time.end}`, t.time.timeZone)
        : new Date(s.getTime() + 3_600_000)
      if (e <= s) e = new Date(e.getTime() + 86_400_000)
      start = { instant: s }
      end = { instant: e }
    } catch {
      /* keep all-day */
    }
  }
  return {
    uid: uidFor(u.id, t.id),
    sequence: sequenceOf(t.updatedAt),
    summary: `${tag} ${t.name}`,
    description,
    start,
    end,
    categories: `Upgrade,${t.phase}`,
    cancelled,
    transparent: 'date' in start, // all-day tasks do not block the calendar
    url: link || undefined,
  }
}

/** A complete VCALENDAR document. */
export function buildIcs(input: IcsInput): { text: string; count: number } {
  const now = input.now ?? new Date()
  const events = buildEvents(input)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Upgrade Tracker//Upgrade Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Upgrade Tracker',
    ...events.flatMap((e) => eventLines(e, now)),
    'END:VCALENDAR',
  ]
  return { text: lines.map(foldLine).join(CRLF) + CRLF, count: events.length }
}

/** Download as a .ics file. */
export function downloadIcs(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "acme-corp" */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
