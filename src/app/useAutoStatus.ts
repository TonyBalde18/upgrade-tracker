import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTracker } from '@/store/tracker'
import { useNow } from '@/lib/useNow'
import { autoStatusChanges } from '@/lib/upgrade/autoStatus'
import { useIsViewer } from '@/store/auth'

/**
 * Applies the automatic upgrade status rules (see lib/upgrade/autoStatus.ts) while
 * the app is open: checked every minute and whenever the data changes.
 * Not an undo step, so Ctrl+Z never fights with it; change the status by hand instead.
 */
export function useAutoStatus(): void {
  const doc = useTracker((s) => s.doc)
  const now = useNow(60_000)

  const viewer = useIsViewer()

  useEffect(() => {
    // the owner's app updates statuses; view-only users never write
    if (viewer) return
    const changes = autoStatusChanges(doc.upgrades, doc.settings, now)
    if (changes.length === 0) return
    const at = new Date().toISOString()
    useTracker.getState().commit(
      `Automatic status update (${changes.length} upgrade${changes.length > 1 ? 's' : ''})`,
      (d) => {
        for (const c of changes) {
          const u = d.upgrades.find((x) => x.id === c.upgradeId)
          if (!u) continue
          u.scheduleStatus = c.statusId
          u.log.unshift({ at, text: c.logText, kind: 'auto' })
          u.updatedAt = at
        }
      },
      { history: false },
    )
    for (const c of changes) {
      const u = doc.upgrades.find((x) => x.id === c.upgradeId)
      const name = doc.customers.find((x) => x.id === u?.customerId)?.name ?? ''
      const label = doc.settings.scheduleStatuses.find((s) => s.id === c.statusId)?.label ?? ''
      toast(`${name} ${u?.family ?? ''}: ${label}`, { description: c.logText })
    }
  }, [doc, now, viewer])
}
