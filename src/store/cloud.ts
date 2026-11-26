/**
 * Keeps the tracker in sync with Firestore, at users/<your uid>/parts/<part id>.
 *
 *  - Live: changes made on another device or tab appear here within a second.
 *  - Edits are written ~0.7 s after the last change (Ctrl+S writes right away).
 *  - Offline: Firestore keeps a copy in this browser; edits are queued and sent
 *    when the connection is back, even after closing the tab.
 *  - Two devices editing different customers or upgrades never overwrite each other
 *    (see lib/cloud/parts.ts). Editing the same one at the same time: the last save wins.
 *  - Data that can not be read is never overwritten: saving stops with a message.
 */
import {
  collection,
  deleteDoc,
  doc as docRef,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  waitForPendingWrites,
  writeBatch,
  type FirestoreError,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/cloud/firebase'
import {
  describePart,
  diffParts,
  joinParts,
  MAX_PART_CHARS,
  mergeParts,
  sameParts,
  splitDoc,
  type Parts,
} from '@/lib/cloud/parts'
import { emptyDoc } from '@/lib/model/defaults'
import type { TrackerDoc } from '@/lib/model/types'
import { useTracker } from './tracker'
import { registerSaver } from './saveControl'
import { useAuth, type AuthRole } from './auth'

const DEBOUNCE_MS = 700
const ERROR_BACKOFF_MS = 30_000
const FIRST_LOAD_TIMEOUT_MS = 10_000
const FIRESTORE_BATCH_LIMIT = 450

let uid: string | null = null
/** what the server had the last time we heard from it */
let base: Parts = new Map()
let loaded = false
/** set when the stored data can not be read: never write over it */
let blocked = false
/** view-only access to someone else's tracker: listen, never write */
let readOnly = false
let applyingRemote = false
let inflight = 0
let pausedUntil = 0
let timer: ReturnType<typeof setTimeout> | null = null
let loadTimer: ReturnType<typeof setTimeout> | null = null
let stopFns: (() => void)[] = []

const store = () => useTracker.getState()
const partsRef = (u: string) => collection(firestore(), 'users', u, 'parts')
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

function applyDoc(d: TrackerDoc) {
  applyingRemote = true
  try {
    store().replaceDoc(d)
  } finally {
    applyingRemote = false
  }
}

function setSaved() {
  store().setSync({ status: 'saved', lastSavedAt: new Date().toISOString(), message: null })
}

function setWaiting() {
  if (offline())
    store().setSync({
      status: 'offline',
      message: 'Offline: changes are kept in this browser and sent when you are back online.',
    })
  else store().setSync({ status: 'saving', message: null })
}

function finishFirstLoad(remote: Parts) {
  if (loadTimer) clearTimeout(loadTimer)
  loadTimer = null
  let d: TrackerDoc | null
  try {
    d = joinParts(remote)
  } catch (e) {
    blocked = true
    loaded = true
    store().setHydrated()
    store().setSync({
      status: 'error',
      message: `Your stored data could not be read (${e instanceof Error ? e.message : String(e)}). Nothing will be overwritten. Export a backup and contact support.`,
    })
    return
  }
  const fresh = d ?? emptyDoc()
  applyDoc(fresh)
  // nothing stored yet: treat the empty document as the server copy (no write needed)
  base = d ? remote : splitDoc(fresh)
  loaded = true
  store().setHydrated()
  if (!sameParts(splitDoc(store().doc), base))
    schedule() // e.g. a schema migration
  else setSaved()
}

function onSnap(snap: QuerySnapshot) {
  // An empty answer from the offline copy may just mean "not downloaded yet": wait for the server.
  if (!loaded && snap.metadata.fromCache && snap.empty) return
  const remote: Parts = new Map(snap.docs.map((d) => [d.id, String(d.get('json') ?? '')]))
  if (!loaded) {
    finishFirstLoad(remote)
    return
  }
  if (blocked) return
  const local = splitDoc(store().doc)
  const merged = mergeParts(base, local, remote)
  base = remote
  if (!sameParts(merged, local)) {
    try {
      const d = joinParts(merged)
      applyDoc(d ?? emptyDoc())
    } catch (e) {
      blocked = true
      store().setSync({
        status: 'error',
        message: `Data changed on another device could not be read (${e instanceof Error ? e.message : String(e)}). Saving is paused so nothing is overwritten. Reload the page.`,
      })
      return
    }
  }
  if (!sameParts(merged, remote)) schedule()
  else if (inflight === 0 && !timer && !snap.metadata.hasPendingWrites) {
    if (store().sync.status !== 'saved' || store().sync.message) setSaved()
  }
}

function onSnapError(e: FirestoreError) {
  if (e.code === 'permission-denied') {
    blocked = true
    useAuth.setState({ status: 'denied' })
    return
  }
  store().setSync({ status: 'error', message: `Could not load your data: ${e.message}` })
}

function schedule() {
  if (timer) clearTimeout(timer)
  if (store().sync.status === 'saved') store().setSync({ status: 'unsaved', message: null })
  const wait = Math.max(DEBOUNCE_MS, pausedUntil - Date.now())
  timer = setTimeout(flush, wait)
}

/** Write every part that differs from the server copy. */
export function flush(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (!uid || !loaded || blocked || readOnly) return
  const current = store().doc
  const local = splitDoc(current)
  const { set, remove } = diffParts(base, local)
  if (set.length === 0 && remove.length === 0) {
    store().clearPending(store().pendingChanges.length)
    if (inflight === 0) setSaved()
    return
  }
  const tooBig = set.find(([, v]) => v.length > MAX_PART_CHARS)
  if (tooBig) {
    store().setSync({
      status: 'error',
      message: `The ${describePart(tooBig[0], current)} is too large to save (remove its logo or some activity log entries).`,
    })
    return
  }
  const db = firestore()
  const ref = partsRef(uid)
  const ops: (() => void)[] = []
  const batches = [writeBatch(db)]
  let count = 0
  const next = () => {
    if (++count % FIRESTORE_BATCH_LIMIT === 0) batches.push(writeBatch(db))
    return batches[batches.length - 1]!
  }
  for (const [id, json] of set)
    ops.push(() => next().set(docRef(ref, id), { json, updatedAt: current.updatedAt }))
  for (const id of remove) ops.push(() => next().delete(docRef(ref, id)))
  ops.forEach((op) => op())

  base = local
  store().clearPending(store().pendingChanges.length)
  inflight++
  setWaiting()
  Promise.all(batches.map((b) => b.commit()))
    .then(() => {
      inflight--
      pausedUntil = 0
      if (inflight === 0 && !timer) setSaved()
    })
    .catch((e: FirestoreError) => {
      inflight--
      if (e.code === 'permission-denied') {
        blocked = true
        useAuth.setState({ status: 'denied' })
        return
      }
      // the server copy is unknown now: the next snapshot resets `base`, then we retry
      pausedUntil = Date.now() + ERROR_BACKOFF_MS
      store().setSync({
        status: 'error',
        message: `Could not save: ${e.message}. Retrying in 30 seconds.`,
      })
      schedule()
    })
}

export function startCloudSync(userId: string, opts: { readOnly?: boolean } = {}): void {
  stopCloudSync()
  uid = userId
  readOnly = opts.readOnly === true
  base = new Map()
  loaded = false
  blocked = false
  store().setSync({ status: 'saving', message: 'Loading your data…' })

  const unsubSnap: Unsubscribe = onSnapshot(
    partsRef(userId),
    { includeMetadataChanges: true },
    onSnap,
    onSnapError,
  )
  // Nothing downloaded on this device yet and no connection: keep waiting (Firestore
  // retries by itself). Opening with an empty tracker here could later overwrite
  // real settings, so the loading screen just explains the delay.
  loadTimer = setTimeout(() => {
    if (!loaded)
      store().setSync({
        status: 'offline',
        message: 'Still waiting for the database. Check your internet connection.',
      })
  }, FIRST_LOAD_TIMEOUT_MS)

  const unsubStore = useTracker.subscribe((s, prev) => {
    if (s.doc !== prev.doc && loaded && !applyingRemote && !readOnly) schedule()
  })
  const onHide = () => {
    if (document.visibilityState === 'hidden' && timer) flush()
  }
  const onUnload = () => {
    if (timer) flush()
  }
  const onNetwork = () => {
    if (inflight > 0) setWaiting()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('beforeunload', onUnload)
  window.addEventListener('online', onNetwork)
  window.addEventListener('offline', onNetwork)
  registerSaver(flush)

  stopFns = [
    unsubSnap,
    unsubStore,
    () => document.removeEventListener('visibilitychange', onHide),
    () => window.removeEventListener('beforeunload', onUnload),
    () => window.removeEventListener('online', onNetwork),
    () => window.removeEventListener('offline', onNetwork),
  ]
}

export function stopCloudSync(): void {
  stopFns.forEach((f) => f())
  stopFns = []
  if (timer) clearTimeout(timer)
  if (loadTimer) clearTimeout(loadTimer)
  timer = loadTimer = null
  registerSaver(null)
  uid = null
  loaded = false
}

/** Send what is left, wait (at most 5 s) for the server to confirm, then stop. */
export async function flushAndStop(): Promise<void> {
  flush()
  try {
    await Promise.race([
      waitForPendingWrites(firestore()),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
  } catch {
    /* ignore */
  }
  stopCloudSync()
}

// --- view access -------------------------------------------------------------------
//
// access/<email> = { ownerUid, addedAt }: written by the owner (Settings > View access).
// The Firestore rules let that email read users/<ownerUid>/..., never write.

const accessRef = (email: string) => docRef(firestore(), 'access', email.trim().toLowerCase())

/** Whose tracker to open after sign-in: your own, or the one shared with you. */
export async function resolveAccess(
  myUid: string,
  email: string,
): Promise<{ role: AuthRole; dataUid: string }> {
  if (email) {
    try {
      const snap = await getDoc(accessRef(email))
      const owner = snap.exists() ? snap.get('ownerUid') : undefined
      if (typeof owner === 'string' && owner && owner !== myUid)
        return { role: 'viewer', dataUid: owner }
    } catch {
      /* no entry or not allowed to look: open your own tracker */
    }
  }
  return { role: 'owner', dataUid: myUid }
}

export interface Viewer {
  email: string
  addedAt: string
}

export async function listViewers(ownerUid: string): Promise<Viewer[]> {
  const snap = await getDocs(
    query(collection(firestore(), 'access'), where('ownerUid', '==', ownerUid)),
  )
  return snap.docs
    .map((d) => ({ email: d.id, addedAt: String(d.get('addedAt') ?? '') }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function addViewer(ownerUid: string, email: string): Promise<void> {
  await setDoc(accessRef(email), { ownerUid, addedAt: new Date().toISOString() })
}

export async function removeViewer(email: string): Promise<void> {
  await deleteDoc(accessRef(email))
}
