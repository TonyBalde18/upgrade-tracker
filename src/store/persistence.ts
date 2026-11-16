/**
 * Keeps the document saved.
 *  - Always: a local cache in localStorage, so the app opens instantly and works offline.
 *  - Local mode: the cache *is* the storage.
 *  - GitHub mode: edits are pushed to the private data repo ~3 s after the last change
 *    (or right away with Ctrl+S). Every push sends the sha it was based on; if GitHub
 *    has a newer version, nothing is overwritten and the user chooses what to do.
 *    Unsent edits (and their descriptions) survive a reload or going offline.
 */
import { create } from 'zustand'
import { toast } from 'sonner'
import { migrate, MigrationError } from '@/lib/migrations'
import { KEYS, readJson, writeJson } from '@/lib/storage/local'
import { loadConnection, loadToken, type ConnectionConfig } from '@/lib/github/config'
import { commitMessage, getFile, GitHubError, putFile, type RemoteFile } from '@/lib/github/client'
import type { TrackerDoc } from '@/lib/model/types'
import { useTracker } from './tracker'

const LOCAL_DEBOUNCE_MS = 400
const REMOTE_DEBOUNCE_MS = 3000
const RETRY_MS = 30_000
const FOCUS_PULL_MIN_MS = 60_000

interface SyncMeta {
  /** sha of the GitHub version the local document is based on */
  baseSha: string | null
  /** which repo/branch/file baseSha belongs to */
  target: string
  /** edit descriptions not yet pushed (kept across reloads) */
  pending: string[]
}

export interface ConflictState {
  remote: RemoteFile | null
  reason: 'push' | 'pull'
}

/** UI state for the "Data changed elsewhere" dialog. */
export const useConflict = create<{ conflict: ConflictState | null }>(() => ({ conflict: null }))

let meta: SyncMeta = {
  baseSha: null,
  target: '',
  pending: [],
  ...(readJson<Partial<SyncMeta>>(KEYS.sync) ?? {}),
}
let localTimer: ReturnType<typeof setTimeout> | null = null
let remoteTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let pushing: Promise<void> | null = null
let lastPull = 0
let started = false

const store = () => useTracker.getState()
export const targetKey = (c: ConnectionConfig) => `${c.owner}/${c.repo}@${c.branch}:${c.path}`
const isGitHub = () => loadConnection().mode === 'github'
const hasData = (d: TrackerDoc) => d.customers.length > 0 || d.upgrades.length > 0

function saveMeta() {
  writeJson(KEYS.sync, meta)
}

function writeCache(): boolean {
  const s = store()
  meta.pending = [...s.pendingChanges]
  saveMeta()
  return writeJson(KEYS.doc, s.doc)
}

/** For tests: reset the module state. */
export function _resetSyncForTests() {
  meta = { baseSha: null, target: '', pending: [] }
  ;[localTimer, remoteTimer, retryTimer].forEach((t) => t && clearTimeout(t))
  localTimer = remoteTimer = retryTimer = null
  pushing = null
  lastPull = 0
  useConflict.setState({ conflict: null })
}

export function syncMeta(): Readonly<SyncMeta> {
  return meta
}

// --- startup ---------------------------------------------------------------------

export function hydrateFromCache(): { ok: boolean; error?: string } {
  const raw = readJson<unknown>(KEYS.doc)
  const s = store()
  if (raw == null) {
    s.setHydrated()
    return { ok: true }
  }
  try {
    const doc = migrate(raw)
    s.replaceDoc(doc)
    if (meta.pending.length) {
      useTracker.setState((st) => {
        st.pendingChanges = [...meta.pending]
      })
      s.setSync({
        status: 'unsaved',
        message: 'Changes from your last session are not on GitHub yet.',
      })
    } else {
      s.setSync({ status: 'saved', lastSavedAt: doc.updatedAt, message: null })
    }
    s.setHydrated()
    return { ok: true }
  } catch (e) {
    // keep a copy so the next save does not destroy the only version
    writeJson(`${KEYS.doc}.unreadable-${Date.now()}`, raw)
    s.setHydrated()
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// --- local saving ------------------------------------------------------------------

function saveLocal(): boolean {
  if (localTimer) {
    clearTimeout(localTimer)
    localTimer = null
  }
  const ok = writeCache()
  if (!ok) {
    store().setSync({
      status: 'error',
      message:
        'Could not write to browser storage (private window or storage full?). Export a JSON backup.',
    })
    return false
  }
  if (!isGitHub()) {
    store().clearPending(store().pendingChanges.length)
    meta.pending = []
    saveMeta()
    store().setSync({ status: 'saved', lastSavedAt: new Date().toISOString(), message: null })
  }
  return true
}

/** Save immediately (Ctrl+S, the sync button). */
export function saveNow(): void {
  if (!saveLocal()) return
  if (isGitHub()) void push()
}

// --- GitHub --------------------------------------------------------------------------

function handleError(e: unknown) {
  const s = store()
  if (e instanceof GitHubError) {
    if (e.kind === 'network') {
      s.setSync({
        status: 'offline',
        message:
          'Offline: your changes are kept in this browser and will be sent when GitHub is reachable.',
      })
      if (!retryTimer)
        retryTimer = setTimeout(() => {
          retryTimer = null
          void push()
        }, RETRY_MS)
      return
    }
    if (e.kind === 'rate') {
      s.setSync({ status: 'error', message: e.message })
      if (!retryTimer)
        retryTimer = setTimeout(() => {
          retryTimer = null
          void push()
        }, RETRY_MS * 4)
      return
    }
    s.setSync({ status: 'error', message: e.message })
    return
  }
  s.setSync({ status: 'error', message: e instanceof Error ? e.message : String(e) })
}

function applyRemote(remote: RemoteFile, c: ConnectionConfig) {
  const doc = migrate(JSON.parse(remote.text))
  store().replaceDoc(doc)
  meta = { baseSha: remote.sha, target: targetKey(c), pending: [] }
  writeJson(KEYS.doc, doc)
  saveMeta()
  store().setSync({ status: 'saved', lastSavedAt: new Date().toISOString(), message: null })
}

/**
 * Send local changes. Uses the sha the document is based on; a newer version on
 * GitHub produces a conflict instead of an overwrite.
 */
export function push(): Promise<void> {
  if (pushing) {
    // a save is running: run once more afterwards
    return pushing.then(() => (store().pendingChanges.length ? push() : undefined))
  }
  pushing = doPush().finally(() => {
    pushing = null
  })
  return pushing
}

async function doPush(): Promise<void> {
  if (remoteTimer) {
    clearTimeout(remoteTimer)
    remoteTimer = null
  }
  if (!isGitHub() || useConflict.getState().conflict) return
  const c = loadConnection()
  const token = loadToken()
  if (!token) {
    store().setSync({ status: 'error', message: 'No GitHub token: add it in Settings.' })
    return
  }
  // never write to a repo/file we have not read first
  if (meta.target !== targetKey(c)) {
    await pull({ silent: true })
    if (meta.target !== targetKey(c) || useConflict.getState().conflict) return
  }
  const s = store()
  const count = s.pendingChanges.length
  if (count === 0 && meta.baseSha) {
    s.setSync({ status: 'saved', message: null })
    return
  }
  s.setSync({ status: 'saving', message: null })
  try {
    const sha = await putFile(
      c,
      token,
      JSON.stringify(s.doc, null, 2),
      meta.baseSha,
      commitMessage(s.pendingChanges.slice(0, count)),
    )
    meta.baseSha = sha
    meta.target = targetKey(c)
    store().clearPending(count)
    writeCache()
    store().setSync({
      status: store().pendingChanges.length ? 'unsaved' : 'saved',
      lastSavedAt: new Date().toISOString(),
      message: null,
    })
    if (store().pendingChanges.length) scheduleRemote()
  } catch (e) {
    if (e instanceof GitHubError && e.kind === 'conflict') {
      useConflict.setState({ conflict: { remote: null, reason: 'push' } })
      store().setSync({
        status: 'error',
        message: 'Data changed elsewhere: choose to reload or overwrite.',
      })
      return
    }
    handleError(e)
  }
}

/**
 * Get the latest version from GitHub.
 *  - same version as ours: nothing to do (send pending edits, if any)
 *  - newer and we have no unsent edits: load it
 *  - newer and we have unsent edits: conflict, the user decides
 *  - file missing: it is created on the next save
 */
export async function pull(opts: { silent?: boolean } = {}): Promise<void> {
  if (!isGitHub()) return
  const c = loadConnection()
  const token = loadToken()
  if (!token) {
    store().setSync({ status: 'error', message: 'No GitHub token: add it in Settings.' })
    return
  }
  lastPull = Date.now()
  const dirty = store().pendingChanges.length > 0
  try {
    if (!dirty) store().setSync({ status: 'saving', message: 'Checking GitHub…' })
    const remote = await getFile(c, token)
    const key = targetKey(c)
    if (!remote) {
      meta = { ...meta, baseSha: null, target: key }
      saveMeta()
      if (hasData(store().doc) || dirty) {
        if (!dirty)
          useTracker.setState((st) => {
            st.pendingChanges.push(`Create ${c.path}`)
          })
        if (!opts.silent)
          toast(`${c.path} does not exist yet`, {
            description: 'It is being created from the data in this browser.',
          })
        await push()
      } else
        store().setSync({
          status: 'saved',
          message: `${c.path} will be created on the first save.`,
        })
      return
    }
    if (remote.sha === meta.baseSha && meta.target === key) {
      if (dirty) await push()
      else store().setSync({ status: 'saved', message: null })
      return
    }
    if (dirty) {
      useConflict.setState({ conflict: { remote, reason: 'pull' } })
      store().setSync({
        status: 'error',
        message: 'Data changed elsewhere: choose to reload or overwrite.',
      })
      return
    }
    try {
      applyRemote(remote, c)
    } catch (e) {
      const why = e instanceof MigrationError || e instanceof SyntaxError ? e.message : String(e)
      store().setSync({
        status: 'error',
        message: `${c.path} on GitHub could not be read: ${why}. Nothing was overwritten.`,
      })
      return
    }
    if (!opts.silent) toast.success('Loaded the latest data from GitHub')
  } catch (e) {
    handleError(e)
  }
}

// --- conflict resolution -------------------------------------------------------------

/** Discard local unsent edits and load the GitHub version. */
export async function resolveReload(): Promise<void> {
  const c = loadConnection()
  try {
    const remote = await getFile(c, loadToken())
    useConflict.setState({ conflict: null })
    if (!remote) {
      meta = { ...meta, baseSha: null, target: targetKey(c) }
      saveMeta()
      return
    }
    applyRemote(remote, c)
    toast.success('Reloaded the version from GitHub')
  } catch (e) {
    handleError(e)
  }
}

/** Keep the local version and write it over the newer GitHub version. */
export async function resolveOverwrite(): Promise<void> {
  const c = loadConnection()
  try {
    const remote = await getFile(c, loadToken())
    meta = { ...meta, baseSha: remote?.sha ?? null, target: targetKey(c) }
    saveMeta()
    useConflict.setState({ conflict: null })
    if (store().pendingChanges.length === 0)
      useTracker.setState((st) => {
        st.pendingChanges.push('Overwrite with the version from this browser')
      })
    await push()
  } catch (e) {
    handleError(e)
  }
}

// --- mode switching --------------------------------------------------------------------

/**
 * Switch from Local to GitHub mode. When both sides have data, `choose` asks the
 * user which one wins (never silent).
 */
export async function connectGitHub(
  choose: (remoteSummary: string) => Promise<'remote' | 'local' | null>,
): Promise<boolean> {
  const c = loadConnection()
  const token = loadToken()
  if (!token) throw new GitHubError('auth', 'Save a token first.')
  const remote = await getFile(c, token)
  const key = targetKey(c)
  const local = store().doc
  const setMode = async () => {
    const { useConnectionStore } = await import('@/app/useConnection')
    useConnectionStore.getState().update({ mode: 'github' })
  }
  if (!remote) {
    await setMode()
    meta = { baseSha: null, target: key, pending: meta.pending }
    useTracker.setState((st) => {
      st.pendingChanges.push(`Create ${c.path}`)
    })
    await push()
    return true
  }
  let remoteDoc: TrackerDoc
  try {
    remoteDoc = migrate(JSON.parse(remote.text))
  } catch (e) {
    throw new GitHubError(
      'unknown',
      `${c.path} on GitHub could not be read: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  let winner: 'remote' | 'local' | null = 'remote'
  if (hasData(local)) {
    winner = await choose(
      `${remoteDoc.customers.length} customer(s) and ${remoteDoc.upgrades.length} upgrade(s) on GitHub, ${local.customers.length} customer(s) and ${local.upgrades.length} upgrade(s) in this browser.`,
    )
  }
  if (!winner) return false
  await setMode()
  if (winner === 'remote') {
    applyRemote(remote, c)
    toast.success('Connected: data loaded from GitHub')
  } else {
    meta = { baseSha: remote.sha, target: key, pending: [] }
    useTracker.setState((st) => {
      st.pendingChanges.push('Upload the data from this browser')
    })
    await push()
    toast.success("Connected: this browser's data was uploaded")
  }
  return true
}

export async function disconnectGitHub(): Promise<void> {
  const { useConnectionStore } = await import('@/app/useConnection')
  useConnectionStore.getState().update({ mode: 'local' })
  if (remoteTimer) clearTimeout(remoteTimer)
  remoteTimer = null
  useConflict.setState({ conflict: null })
  saveLocal()
}

// --- wiring ------------------------------------------------------------------------------

function scheduleRemote() {
  if (remoteTimer) clearTimeout(remoteTimer)
  remoteTimer = setTimeout(() => void push(), REMOTE_DEBOUNCE_MS)
}

export function startAutoPersist(): () => void {
  if (started) return () => {}
  started = true
  const unsub = useTracker.subscribe((s, prev) => {
    if (s.doc !== prev.doc && s.hydrated) {
      if (s.sync.status !== 'unsaved' && s.sync.status !== 'saving')
        store().setSync({ status: 'unsaved', message: null })
      if (localTimer) clearTimeout(localTimer)
      localTimer = setTimeout(saveLocal, LOCAL_DEBOUNCE_MS)
      if (isGitHub()) scheduleRemote()
    }
  })
  const onUnload = () => {
    if (localTimer) saveLocal()
  }
  const onOnline = () => {
    if (isGitHub() && store().pendingChanges.length) void push()
  }
  const onFocus = () => {
    if (document.hidden || !isGitHub()) return
    if (store().pendingChanges.length === 0 && Date.now() - lastPull > FOCUS_PULL_MIN_MS)
      void pull({ silent: false })
  }
  window.addEventListener('beforeunload', onUnload)
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
  if (isGitHub()) void pull({ silent: true })
  return () => {
    unsub()
    window.removeEventListener('beforeunload', onUnload)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onFocus)
    started = false
  }
}
