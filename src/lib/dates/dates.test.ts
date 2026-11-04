import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  addHoursToHHmm,
  avoidWeekend,
  convertLocal,
  formatDay,
  isoWeekOf,
  todayIn,
  zonedToInstant,
} from '.'

describe('calendar dates', () => {
  it('formats as "Mon 23 Nov 2026"', () => {
    expect(formatDay('2026-11-23')).toBe('Mon 23 Nov 2026')
    expect(formatDay(null)).toBe('N/A')
  })

  it('adds days across month and DST boundaries without drifting', () => {
    expect(addDaysIso('2026-10-24', 2)).toBe('2026-10-26') // EU DST ends 25 Oct 2026
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysIso('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('moves weekend dates to Friday or Monday', () => {
    expect(avoidWeekend('2026-11-21', -1)).toBe('2026-11-20') // Sat -> Fri
    expect(avoidWeekend('2026-11-22', -1)).toBe('2026-11-20') // Sun -> Fri
    expect(avoidWeekend('2026-11-21', 1)).toBe('2026-11-23') // Sat -> Mon
    expect(avoidWeekend('2026-11-22', 1)).toBe('2026-11-23') // Sun -> Mon
    expect(avoidWeekend('2026-11-24', -1)).toBe('2026-11-24') // Tue unchanged
  })
})

describe('ISO-8601 weeks', () => {
  it('handles year boundaries', () => {
    expect(isoWeekOf('2026-11-23')).toEqual({ year: 2026, week: 48, monday: '2026-11-23' })
    // 1 Jan 2027 is a Friday -> belongs to week 53 of 2026
    expect(isoWeekOf('2027-01-01')).toMatchObject({ year: 2026, week: 53 })
    // 29 Dec 2025 (Monday) is week 1 of 2026
    expect(isoWeekOf('2025-12-29')).toMatchObject({ year: 2026, week: 1 })
  })
})

describe('time zones', () => {
  it('converts a Zurich window to Lisbon time', () => {
    // winter: CET (UTC+1) -> WET (UTC+0)
    expect(convertLocal('2026-11-24T00:15', 'Europe/Zurich', 'Europe/Lisbon')).toBe(
      '2026-11-23T23:15',
    )
    // summer: CEST (UTC+2) -> WEST (UTC+1)
    expect(convertLocal('2026-07-07T00:15', 'Europe/Zurich', 'Europe/Lisbon')).toBe(
      '2026-07-06T23:15',
    )
  })

  it('gives the right instant', () => {
    expect(zonedToInstant('2026-11-24T00:15', 'Europe/Zurich').toISOString()).toBe(
      '2026-11-23T23:15:00.000Z',
    )
  })

  it('computes today in a zone', () => {
    const now = new Date('2026-11-23T23:30:00Z')
    expect(todayIn('Europe/Lisbon', now)).toBe('2026-11-23')
    expect(todayIn('Europe/Zurich', now)).toBe('2026-11-24')
  })

  it('adds hours to HH:mm with wrap-around', () => {
    expect(addHoursToHHmm('00:15', 3)).toBe('03:15')
    expect(addHoursToHHmm('22:00', 3)).toBe('01:00')
    expect(addHoursToHHmm('10:00', 1.5)).toBe('11:30')
  })
})
