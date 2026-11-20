import { AnimatePresence, motion } from 'motion/react'
import { DatabaseBackup, X } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { backupDue, useBackupReminder } from '@/store/backupReminder'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { exportBackup } from './actions'

/** A thin bar under the top bar when the last JSON backup is over 30 days old. */
export function BackupReminder() {
  const hasData = useTracker((s) => s.doc.customers.length > 0 || s.doc.upgrades.length > 0)
  const lastBackupAt = useBackupReminder((s) => s.lastBackupAt)
  const snoozedUntil = useBackupReminder((s) => s.snoozedUntil)
  const snooze = useBackupReminder((s) => s.snooze)
  const now = useNow(3_600_000)
  const { due, days } = backupDue({ lastBackupAt, snoozedUntil }, hasData, now)

  return (
    <AnimatePresence initial={false}>
      {due && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-warning/30 bg-warning/10"
          role="status"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-sm">
            <DatabaseBackup className="h-4 w-4 shrink-0 text-warning" />
            <span className="min-w-0 flex-1">
              {days === null ? 'No backup from this browser yet.' : `Last backup ${days} days ago.`}{' '}
              <span className="text-muted">
                Firebase keeps no older versions: a JSON export is your safety net.
              </span>
            </span>
            <Button size="sm" variant="primary" onClick={exportBackup}>
              Export JSON now
            </Button>
            <Button size="sm" variant="ghost" onClick={snooze} aria-label="Remind me in a week">
              <X className="h-3.5 w-3.5" /> In a week
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
