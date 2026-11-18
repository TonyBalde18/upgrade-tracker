import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, LoaderCircle, LogIn, LogOut, ShieldAlert, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/misc'
import { RedFlow } from '@/components/ui/RedFlow'
import { signInWithGoogle, signOutAndClear, useAuth } from '@/store/auth'
import { useTracker } from '@/store/tracker'

const ICON_SRC = `${import.meta.env.BASE_URL}icon-4.png`

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex h-full items-center justify-center overflow-hidden p-6">
      <div className="bg-pattern-grid absolute inset-0 -z-20" />
      <RedFlow className="-z-10" lines={9} />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-md"
      >
        <Card className="flex flex-col gap-5 p-8">
          <div className="flex items-center gap-3">
            <img src={ICON_SRC} alt="" className="h-10 w-10 rounded-lg" draggable={false} />
            <div>
              <div className="eyebrow text-accent-text">We make work flow</div>
              <div className="font-heading text-lg font-bold tracking-tight">Upgrade Tracker</div>
            </div>
          </div>
          {children}
        </Card>
      </motion.div>
    </div>
  )
}

function Waiting({ text, detail }: { text: string; detail?: string | null }) {
  return (
    <Screen>
      <div className="flex items-center gap-3 text-sm text-muted" role="status">
        <LoaderCircle className="h-5 w-5 animate-spin text-accent-text" />
        {text}
      </div>
      {detail && <p className="text-xs text-subtle">{detail}</p>}
    </Screen>
  )
}

function SignIn() {
  const busy = useAuth((s) => s.busy)
  const error = useAuth((s) => s.error)
  return (
    <Screen>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Use your Google account to see your customers and upgrade plans.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        onClick={() => void signInWithGoogle()}
        disabled={busy}
        className="w-full"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in with Google
      </Button>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 overflow-hidden rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="text-xs text-subtle">
        Only the Google account allowed in the database rules can see any data.
      </p>
    </Screen>
  )
}

function Denied() {
  const email = useAuth((s) => s.user?.email)
  return (
    <Screen>
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <h1 className="font-semibold">No access</h1>
          <p className="mt-1 text-sm text-muted">
            The account <b className="text-text">{email || 'you signed in with'}</b> is not allowed
            to open this tracker. Sign out and use the right Google account.
          </p>
        </div>
      </div>
      <Button onClick={() => void signOutAndClear()}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </Screen>
  )
}

function NotConfigured() {
  return (
    <Screen>
      <div className="flex items-start gap-3">
        <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
        <div>
          <h1 className="font-semibold">Firebase is not set up yet</h1>
          <p className="mt-1 text-sm text-muted">
            Fill in <code className="font-mono text-xs">src/firebase.config.ts</code> with the
            values of your Firebase web app. The README explains every step.
          </p>
        </div>
      </div>
    </Screen>
  )
}

/** Shows the app only to a signed-in user whose data has loaded. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status)
  const hydrated = useTracker((s) => s.hydrated)
  const syncMessage = useTracker((s) => s.sync.message)

  switch (status) {
    case 'unconfigured':
      return <NotConfigured />
    case 'loading':
      return <Waiting text="Checking your sign-in…" />
    case 'signedOut':
      return <SignIn />
    case 'denied':
      return <Denied />
    case 'signedIn':
      return hydrated ? <>{children}</> : <Waiting text="Loading your data…" detail={syncMessage} />
  }
}
