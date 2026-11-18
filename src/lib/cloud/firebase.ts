/**
 * Firebase setup. Only loaded on demand (dynamic import), so the sign-in screen
 * appears before the Firebase code has downloaded and tests never touch it.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from '@/firebase.config'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function firebaseApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig)
  return app
}

export function firebaseAuth(): Auth {
  auth ??= getAuth(firebaseApp())
  return auth
}

/**
 * Firestore with an offline copy in IndexedDB (shared between tabs), so the app
 * opens instantly and edits made offline are sent when the connection is back.
 */
export function firestore(): Firestore {
  if (db) return db
  try {
    db = initializeFirestore(firebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // e.g. IndexedDB blocked in a private window: work online only
    db = initializeFirestore(firebaseApp(), { localCache: memoryLocalCache() })
  }
  return db
}
