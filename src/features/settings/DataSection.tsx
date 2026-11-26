import { type ReactNode } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { useAuth } from '@/store/auth'
import { useTracker } from '@/store/tracker'
import { saveNow } from '@/store/saveControl'
import { confirmSignOut } from '@/app/actions'
import { firebaseConfig } from '@/firebase.config'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

/** Signed-in account and the state of the database sync. */
export function DataSection({ wrap }: { wrap: (children: ReactNode) => ReactNode }) {
  const user = useAuth((s) => s.user)
  const viewer = useAuth((s) => s.role === 'viewer')
  const sync = useTracker((s) => s.sync)

  const state =
    sync.message ??
    (sync.status === 'saved'
      ? `All changes saved${sync.lastSavedAt ? ` (${formatDistanceToNowStrict(new Date(sync.lastSavedAt))} ago)` : ''}.`
      : sync.status === 'unsaved' || sync.status === 'saving'
        ? 'Saving…'
        : 'Not loaded yet.')

  return wrap(
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{user?.name || 'Signed in'}</div>
          <div className="truncate text-sm text-muted">{user?.email}</div>
        </div>
        {!viewer && <Button onClick={saveNow}>Save now</Button>}
        <Button variant="danger" onClick={() => void confirmSignOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
      <div
        className={cn(
          'rounded-xl border px-3 py-2 text-xs',
          sync.status === 'error' ? 'border-danger/40 text-danger' : 'border-border text-muted',
        )}
        aria-live="polite"
      >
        {state}
      </div>
      {viewer && (
        <p className="rounded-xl border border-sky-400/40 px-3 py-2 text-sm">
          You have <b>view-only</b> access to a tracker shared with you. You see every change live
          and can export to Excel or print, but you can not change anything.
        </p>
      )}
      <p className={cn('text-xs text-subtle', viewer && 'hidden')}>
        Saved automatically in your Firebase database ({firebaseConfig.projectId || 'not set up'}),
        live on every device you sign in with. Edits made offline are sent when you are back online.
        Signing out removes the offline copy from this browser.
      </p>
    </div>,
  )
}
