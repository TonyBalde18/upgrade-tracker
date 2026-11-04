/**
 * Date helpers. Conventions:
 *  - Calendar dates are ISO strings "YYYY-MM-DD" and are handled as plain dates
 *    (no time zone), so they never drift when the display zone changes.
 *  - Window start times are "YYYY-MM-DDTHH:mm" in a named IANA zone and are
 *    converted to real instants with date-fns-tz.
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  isValid,
  parseISO,
  startOfISOWeek,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { IsoDate, LocalDateTime, TimeZone } from '@/lib/model/types'

export const DAY_FORMAT = 'EEE d MMM yyyy' // Mon 23 Nov 2026
export const TIME_FORMAT = 'HH:mm'

/** Parse "YYYY-MM-DD" to a local-midnight Date (for calendar arithmetic only). */
export function parseDay(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function toIsoDate(d: Date): IsoDate {
  return format(d, 'yyyy-MM-dd')
}

export function isIsoDate(s: unknown): s is IsoDate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s))
}

export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  return toIsoDate(addDays(parseDay(iso), days))
}

export function diffDaysIso(a: IsoDate, b: IsoDate): number {
  return differenceInCalendarDays(parseDay(a), parseDay(b))
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(iso: IsoDate): number {
  return parseDay(iso).getDay()
}

export function isWeekend(iso: IsoDate): boolean {
  const d = weekdayOf(iso)
  return d === 0 || d === 6
}

/** Move a weekend date to the previous Friday (direction -1) or next Monday (direction +1). */
export function avoidWeekend(iso: IsoDate, direction: -1 | 1): IsoDate {
  const d = weekdayOf(iso)
  if (d === 6) return addDaysIso(iso, direction < 0 ? -1 : 2)
  if (d === 0) return addDaysIso(iso, direction < 0 ? -2 : 1)
  return iso
}

export function formatDay(iso: IsoDate | null | undefined, fmt: string = DAY_FORMAT): string {
  if (!iso) return 'N/A'
  return format(parseDay(iso), fmt)
}

export interface IsoWeek {
  year: number
  week: number
  /** Monday of that ISO week */
  monday: IsoDate
}

export function isoWeekOf(iso: IsoDate): IsoWeek {
  const d = parseDay(iso)
  return { year: getISOWeekYear(d), week: getISOWeek(d), monday: toIsoDate(startOfISOWeek(d)) }
}

// ---------------------------------------------------------------------------
// Time zones

/** The real instant of a local date-time in a zone. */
export function zonedToInstant(local: LocalDateTime, tz: TimeZone): Date {
  return fromZonedTime(local, tz)
}

/** Format an instant as seen in a zone. */
export function formatInZone(instant: Date, tz: TimeZone, fmt: string): string {
  return formatInTimeZone(instant, tz, fmt)
}

/** Convert a local date-time from one zone to another, as "YYYY-MM-DDTHH:mm". */
export function convertLocal(local: LocalDateTime, from: TimeZone, to: TimeZone): LocalDateTime {
  return formatInTimeZone(fromZonedTime(local, from), to, "yyyy-MM-dd'T'HH:mm")
}

/** Short zone name at a given instant, e.g. "CET", "CEST", "GMT+1". */
export function zoneAbbr(tz: TimeZone, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(at)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}

/** Today's calendar date in a zone. */
export function todayIn(tz: TimeZone, now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, tz, 'yyyy-MM-dd')
}

/** Current local date-time in a zone. */
export function nowIn(tz: TimeZone, now: Date = new Date()): Date {
  return toZonedTime(now, tz)
}

let zoneCache: string[] | null = null
export function allTimeZones(): string[] {
  if (zoneCache) return zoneCache
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    zoneCache = intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    zoneCache = []
  }
  if (zoneCache.length === 0) {
    zoneCache = [
      'UTC',
      'Europe/Lisbon',
      'Europe/London',
      'Europe/Zurich',
      'Europe/Berlin',
      'Europe/Paris',
    ]
  }
  if (!zoneCache.includes('UTC')) zoneCache = ['UTC', ...zoneCache]
  return zoneCache
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Add hours to "HH:mm", wrapping at midnight. */
export function addHoursToHHmm(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = ((((h ?? 0) * 60 + (m ?? 0) + Math.round(hours * 60)) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Human countdown: "3d 4h", "5h 12m", "12m 30s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}
