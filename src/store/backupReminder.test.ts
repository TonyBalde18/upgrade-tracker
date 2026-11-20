import { describe, expect, it } from 'vitest'
import { backupDue } from './backupReminder'

const now = new Date('2026-11-20T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

describe('backup reminder', () => {
  it('asks when there is data and no backup yet', () => {
    expect(backupDue({ lastBackupAt: null, snoozedUntil: null }, true, now)).toEqual({
      due: true,
      days: null,
    })
    expect(backupDue({ lastBackupAt: null, snoozedUntil: null }, false, now).due).toBe(false)
  })
  it('asks again after 30 days', () => {
    expect(backupDue({ lastBackupAt: daysAgo(29), snoozedUntil: null }, true, now).due).toBe(false)
    expect(backupDue({ lastBackupAt: daysAgo(30), snoozedUntil: null }, true, now)).toEqual({
      due: true,
      days: 30,
    })
  })
  it('stays quiet while snoozed', () => {
    const until = new Date(now.getTime() + 86_400_000).toISOString()
    expect(backupDue({ lastBackupAt: daysAgo(90), snoozedUntil: until }, true, now).due).toBe(false)
  })
})
