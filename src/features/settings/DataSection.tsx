import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LoaderCircle,
  PlugZap,
  XCircle,
} from 'lucide-react'
import { useConnection, useConnectionStore } from '@/app/useConnection'
import { useTracker } from '@/store/tracker'
import {
  connectGitHub,
  disconnectGitHub,
  pull,
  saveNow,
  syncMeta,
  targetKey,
} from '@/store/persistence'
import { loadToken, maskToken } from '@/lib/github/config'
import { testConnection, type ConnectionReport } from '@/lib/github/client'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { choose, confirm } from '@/components/ui/confirm'
import { cn } from '@/components/ui/cn'

export function DataSection({ wrap }: { wrap: (children: ReactNode) => ReactNode }) {
  const conn = useConnection()
  const update = useConnectionStore((s) => s.update)
  const setToken = useConnectionStore((s) => s.setToken)
  const forgetToken = useConnectionStore((s) => s.forgetToken)
  const sync = useTracker((s) => s.sync)
  const [tokenDraft, setTokenDraft] = useState('')
  const [showDraft, setShowDraft] = useState(false)
  const [testing, setTesting] = useState(false)
  const [report, setReport] = useState<ConnectionReport | null>(null)
  const [busy, setBusy] = useState(false)

  const isGitHub = conn.mode === 'github'
  const meta = syncMeta()
  const inSync = isGitHub && meta.target === targetKey(conn) && meta.baseSha

  const saveTokenDraft = () => {
    if (!tokenDraft.trim()) return
    setToken(tokenDraft)
    setTokenDraft('')
    setReport(null)
    toast.success('Token saved in this browser')
  }

  const runTest = async () => {
    setTesting(true)
    setReport(null)
    try {
      setReport(await testConnection(conn, loadToken()))
    } finally {
      setTesting(false)
    }
  }

  const switchMode = async (mode: 'local' | 'github') => {
    if (mode === conn.mode) return
    if (mode === 'local') {
      const ok = await confirm({
        title: 'Switch to Local mode?',
        body: 'This browser keeps the current data but stops syncing with GitHub. Your data on GitHub is not deleted.',
        confirmLabel: 'Switch to Local',
      })
      if (ok) {
        await disconnectGitHub()
        toast('Local mode: data stays in this browser')
      }
      return
    }
    if (!loadToken()) {
      toast.error('Save a token first', {
        description: 'Paste your fine-grained token below, then switch to GitHub.',
      })
      return
    }
    setBusy(true)
    try {
      await connectGitHub(async (summary) => {
        const v = await choose<'remote' | 'local' | 'cancel'>({
          title: 'Which data should win?',
          body: `Both GitHub and this browser have data. ${summary}`,
          choices: [
            { value: 'cancel', label: 'Cancel' },
            { value: 'local', label: "Upload this browser's data", variant: 'danger' },
            { value: 'remote', label: 'Use the GitHub data', variant: 'primary' },
          ],
        })
        return v === 'cancel' ? null : v
      })
    } catch (e) {
      toast.error('Could not connect to GitHub', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(false)
    }
  }

  return wrap(
    <div className="flex flex-col gap-5">
      <Field
        label="Mode"
        hint={
          isGitHub
            ? 'Changes are saved to GitHub about 3 seconds after your last edit (Ctrl+S saves now).'
            : 'Data lives only in this browser. Use Export JSON for backups.'
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel="Data mode"
            value={conn.mode}
            onChange={(m) => void switchMode(m)}
            options={[
              {
                value: 'local',
                label: (
                  <>
                    <HardDrive className="h-3.5 w-3.5" /> Local (this browser)
                  </>
                ),
              },
              {
                value: 'github',
                label: (
                  <>
                    <Cloud className="h-3.5 w-3.5" /> GitHub
                  </>
                ),
              },
            ]}
          />
          {busy && <LoaderCircle className="h-4 w-4 animate-spin text-subtle" />}
          {isGitHub && (
            <>
              <Button size="sm" onClick={() => void pull({ silent: false })}>
                <CloudDownload className="h-3.5 w-3.5" /> Pull latest
              </Button>
              <Button size="sm" onClick={saveNow}>
                <CloudUpload className="h-3.5 w-3.5" /> Save now
              </Button>
            </>
          )}
        </div>
      </Field>

      {isGitHub && (
        <div
          className={cn(
            'rounded-xl border px-3 py-2 text-xs',
            sync.status === 'error' ? 'border-danger/40 text-danger' : 'border-border text-muted',
          )}
        >
          {sync.message ??
            (inSync
              ? `In sync with ${conn.owner}/${conn.repo} (${conn.branch}), version ${meta.baseSha?.slice(0, 7)}.`
              : 'Not synced yet.')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="GitHub owner" htmlFor="gh-owner">
          <Input
            id="gh-owner"
            value={conn.owner}
            onChange={(e) => update({ owner: e.target.value.trim() })}
          />
        </Field>
        <Field label="Data repository (private)" htmlFor="gh-repo">
          <Input
            id="gh-repo"
            value={conn.repo}
            onChange={(e) => update({ repo: e.target.value.trim() })}
          />
        </Field>
        <Field label="Branch" htmlFor="gh-branch">
          <Input
            id="gh-branch"
            value={conn.branch}
            onChange={(e) => update({ branch: e.target.value.trim() })}
          />
        </Field>
        <Field label="File path" htmlFor="gh-path">
          <Input
            id="gh-path"
            value={conn.path}
            onChange={(e) => update({ path: e.target.value.trim() })}
          />
        </Field>
      </div>

      <Field
        label="Fine-grained personal access token"
        hint="Only the data repository, permission Contents: Read and write, with an expiry date. Stored only in this browser, never in the data file."
      >
        {conn.hasToken ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-60 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 font-mono text-xs text-muted">
              <KeyRound className="h-4 w-4 text-subtle" />
              {maskToken(loadToken())}
            </div>
            <Button variant="primary" onClick={() => void runTest()} disabled={testing}>
              {testing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}{' '}
              Test connection
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Forget the token?',
                    body: 'It is removed from this browser. Saving to GitHub stops until you paste a token again.',
                    confirmLabel: 'Forget token',
                    danger: true,
                  })
                ) {
                  forgetToken()
                  setReport(null)
                  toast('Token removed from this browser')
                }
              }}
            >
              Forget token
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showDraft ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTokenDraft()}
                placeholder="github_pat_…"
                className="pr-10 font-mono text-xs"
                aria-label="Personal access token"
              />
              <button
                type="button"
                onClick={() => setShowDraft((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1 text-subtle hover:text-text"
                aria-label={showDraft ? 'Hide token' : 'Show token'}
              >
                {showDraft ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button variant="primary" onClick={saveTokenDraft} disabled={!tokenDraft.trim()}>
              Save token
            </Button>
          </div>
        )}
      </Field>

      <AnimatePresence>
        {report && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              'flex flex-col gap-1.5 overflow-hidden rounded-xl border p-3',
              report.ok ? 'border-success/40' : 'border-danger/40',
            )}
            aria-live="polite"
          >
            {report.steps.map((s, i) => (
              <motion.li
                key={s.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
                className="flex items-start gap-2 text-sm"
              >
                {s.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                )}
                <span>
                  <b>{s.label}</b>
                  {s.detail ? <span className="text-muted"> · {s.detail}</span> : null}
                </span>
              </motion.li>
            ))}
            {report.ok && !isGitHub && (
              <li className="pt-1 text-xs text-muted">
                All good. Switch the mode to GitHub to start syncing.
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>,
  )
}
