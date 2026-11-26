import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Eye, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { confirm } from '@/components/ui/confirm'

interface Viewer {
  email: string
  addedAt: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const cloud = () => import('@/store/cloud')

/**
 * People who may open this tracker in view-only mode. Stored in the database
 * (access/<email>), never in the code; the Firestore rules enforce read-only.
 */
export function ViewAccessSection() {
  const user = useAuth((s) => s.user)
  const [viewers, setViewers] = useState<Viewer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setViewers(await (await cloud()).listViewers(user.uid))
      setError(null)
    } catch (e) {
      setViewers([])
      setError(
        (e as { code?: string })?.code === 'permission-denied'
          ? 'The database rules do not allow managing view access yet. Update them as described in the README (section "Give a colleague view access").'
          : `Could not load the list: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    const email = draft.trim().toLowerCase()
    if (!user || !EMAIL.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    if (email === user.email.toLowerCase()) {
      toast.error('That is your own account')
      return
    }
    setBusy(true)
    try {
      await (await cloud()).addViewer(user.uid, email)
      setDraft('')
      toast.success(`${email} can now view this tracker`, {
        description: 'They open the same web address and sign in with that Google account.',
      })
      await load()
    } catch (e) {
      toast.error('Could not add', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (email: string) => {
    const ok = await confirm({
      title: 'Remove view access?',
      body: `${email} will no longer be able to open this tracker (from their next page load).`,
      confirmLabel: 'Remove access',
      danger: true,
    })
    if (!ok) return
    try {
      await (await cloud()).removeViewer(email)
      toast(`${email} removed`)
      await load()
    } catch (e) {
      toast.error('Could not remove', { description: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-xl border border-danger/40 px-3 py-2 text-xs text-danger">{error}</p>
      )}
      {viewers === null ? (
        <LoaderCircle className="h-4 w-4 animate-spin text-subtle" />
      ) : viewers.length === 0 ? (
        <p className="text-sm text-muted">
          Nobody else has access. Only you can open this tracker.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {viewers.map((v) => (
            <li
              key={v.email}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              <Eye className="h-4 w-4 shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate text-sm">{v.email}</span>
              <span className="hidden text-xs text-subtle sm:inline">view only</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void remove(v.email)}
                aria-label={`Remove ${v.email}`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex max-w-lg items-center gap-2">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="colleague@example.com (their Google account)"
          aria-label="Email of the person to give view access"
        />
        <Button onClick={() => void add()} disabled={busy || !draft.trim()}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{' '}
          Give view access
        </Button>
      </div>
      <p className="text-xs text-subtle">
        They see everything (customers, plans, timeline) and can export to Excel or print, but
        cannot change anything. Only share with people allowed to see this customer data.
      </p>
    </div>
  )
}
