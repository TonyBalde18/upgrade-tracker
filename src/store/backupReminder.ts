/**
 * Backup reminder: Firebase's free plan keeps no history, so the app nudges you to
 * export a JSON backup when the last one (from this browser) is over 30 days old.
 * Remembered per browser in localStorage: no change to the data file.
 */
import { create } from 'zustand'
import { KEYS, readJson, writeJson } from '@/lib/storage/local'

export const BACKUP_EVERY_DAYS = 30
const SNOOZE_DAYS = 7
const DAY = 86_400_000

interface Stored {
  lastBackupAt: string | null
  snoozedUntil: string | null
}

interface BackupState extends Stored {
  markBackedUp: () => void
  snooze: () => void
}

const stored = readJson<Partial<Stored>>(KEYS.backup) ?? {}

export const useBackupReminder = create<BackupState>()((set, get) => {
  const save = (patch: Partial<Stored>) => {
    set(patch)
    const { lastBackupAt, snoozedUntil } = get()
    writeJson(KEYS.backup, { lastBackupAt, snoozedUntil })
  }
  return {
    lastBackupAt: stored.lastBackupAt ?? null,
    snoozedUntil: stored.snoozedUntil ?? null,
    markBackedUp: () => save({ lastBackupAt: new Date().toISOString(), snoozedUntil: null }),
    snooze: () => save({ snoozedUntil: new Date(Date.now() + SNOOZE_DAYS * DAY).toISOString() }),
  }
})

/** Days since the last backup (null = never), and whether to show the reminder. */
export function backupDue(
  s: Pick<Stored, 'lastBackupAt' | 'snoozedUntil'>,
  hasData: boolean,
  now: Date,
): { due: boolean; days: number | null } {
  const days = s.lastBackupAt
    ? Math.floor((now.getTime() - new Date(s.lastBackupAt).getTime()) / DAY)
    : null
  const snoozed = s.snoozedUntil != null && new Date(s.snoozedUntil) > now
  const due = hasData && !snoozed && (days === null || days >= BACKUP_EVERY_DAYS)
  return { due, days }
}
