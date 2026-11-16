import { useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { useConflict, resolveOverwrite, resolveReload } from '@/store/persistence'
import { useTracker } from '@/store/tracker'
import { exportJson } from '@/lib/storage/backup'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

/**
 * Shown when GitHub has a newer version than the one our unsent edits are based on.
 * It cannot be dismissed by accident: nothing is lost until the user picks a side.
 */
export function ConflictDialog() {
  const conflict = useConflict((s) => s.conflict)
  const pending = useTracker((s) => s.pendingChanges)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={conflict != null}
      onOpenChange={() => undefined}
      hideClose
      title="Data changed elsewhere"
      description="The data file on GitHub was changed (another browser or device?) after this browser loaded it. Nothing has been overwritten. Choose what to keep."
      footer={
        <>
          <Button onClick={() => exportJson(useTracker.getState().doc)} disabled={busy}>
            <Download className="h-4 w-4" /> Download my version
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void run(resolveReload)}>
            Reload from GitHub
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void run(resolveOverwrite)}
            autoFocus
          >
            Overwrite with mine
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-surface-2 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <b>Reload from GitHub</b> discards your {pending.length} unsent change
            {pending.length === 1 ? '' : 's'} below.
            <br />
            <b>Overwrite with mine</b> replaces the GitHub version with what you see now (its
            history stays in the repository).
          </div>
        </div>
        {pending.length > 0 && (
          <div>
            <div className="eyebrow mb-1">Your unsent changes</div>
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-muted">
              {pending.slice(0, 30).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
              {pending.length > 30 && <li>…and {pending.length - 30} more</li>}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}
