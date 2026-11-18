/**
 * Google sign-in state. The Firebase code is loaded on demand, so the sign-in
 * screen shows right away and the unit tests never load Firebase.
 */
import { create } from 'zustand'
import { isFirebaseConfigured } from '@/firebase.config'

export type AuthStatus =
  | 'unconfigured' // src/firebase.config.ts is still empty
  | 'loading' // checking whether you are already signed in
  | 'signedOut'
  | 'signedIn'
  | 'denied' // signed in, but the database rules do not allow this account

export interface AuthUser {
  uid: string
  email: string
  name: string
}

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** last sign-in problem, shown on the sign-in screen */
  error: string | null
  busy: boolean
}

export const useAuth = create<AuthState>()(() => ({
  status: isFirebaseConfigured() ? 'loading' : 'unconfigured',
  user: null,
  error: null,
  busy: false,
}))

const loadFirebase = () => Promise.all([import('@/lib/cloud/firebase'), import('firebase/auth')])

let started = false

/** Watch the sign-in state; start or stop the data sync accordingly. */
export async function startAuth(): Promise<void> {
  if (started || !isFirebaseConfigured()) return
  started = true
  try {
    const [[{ firebaseAuth }, { onAuthStateChanged }], cloud] = await Promise.all([
      loadFirebase(),
      import('./cloud'),
    ])
    onAuthStateChanged(firebaseAuth(), (u) => {
      if (u) {
        useAuth.setState({
          status: 'signedIn',
          user: { uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' },
          error: null,
        })
        cloud.startCloudSync(u.uid)
      } else {
        cloud.stopCloudSync()
        useAuth.setState({ status: 'signedOut', user: null })
      }
    })
  } catch (e) {
    started = false
    useAuth.setState({
      status: 'signedOut',
      error: `Could not load the sign-in code: ${e instanceof Error ? e.message : String(e)}. Check your connection and reload.`,
    })
  }
}

function signInMessage(e: unknown): string | null {
  const code = (e as { code?: string } | null)?.code ?? ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/unauthorized-domain':
      return 'This web address is not allowed to sign in yet. Add it under Authentication > Settings > Authorized domains in the Firebase console (see README).'
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in the Firebase project (Authentication > Sign-in method).'
    case 'auth/network-request-failed':
      return 'Could not reach Google. Check your internet connection and try again.'
    default:
      return `Sign-in failed${code ? ` (${code})` : ''}. Try again.`
  }
}

export async function signInWithGoogle(): Promise<void> {
  useAuth.setState({ busy: true, error: null })
  try {
    const [{ firebaseAuth }, { GoogleAuthProvider, signInWithPopup }] = await loadFirebase()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(firebaseAuth(), provider)
  } catch (e) {
    useAuth.setState({ error: signInMessage(e) })
  } finally {
    useAuth.setState({ busy: false })
  }
}

/**
 * Sign out and remove the offline copy of the data from this browser.
 * Unsent changes are sent first (waits up to a few seconds).
 */
export async function signOutAndClear(): Promise<void> {
  const [[{ firebaseAuth, firestore }, { signOut }], cloud, fs] = await Promise.all([
    loadFirebase(),
    import('./cloud'),
    import('firebase/firestore'),
  ])
  await cloud.flushAndStop()
  const db = firestore()
  await signOut(firebaseAuth())
  try {
    await fs.terminate(db)
    await fs.clearIndexedDbPersistence(db)
  } catch {
    /* another tab still has it open: it is cleared on the next sign-out */
  }
  window.location.reload()
}
