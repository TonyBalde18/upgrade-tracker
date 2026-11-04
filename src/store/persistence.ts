/**
 * Keeps the document saved.
 *  - Always: a local cache in localStorage so the app opens instantly and works offline.
 *  - Local mode: the cache *is* the storage.
 *  - GitHub mode: added in phase 6 (debounced remote save, conflicts).
 */
import { migrate } from '@/lib/migrations'
import { KEYS, readJson, writeJson } from '@/lib/storage/local'
import { loadConnection } from '@/lib/github/config'
import { useTracker } from './tracker'

const LOCAL_DEBOUNCE_MS = 400

let timer: ReturnType<typeof setTimeout> | null = null
let started = false

export function hydrateFromCache(): { ok: boolean; error?: string } {
  const raw = readJson<unknown>(KEYS.doc)
  const store = useTracker.getState()
  if (raw == null) {
    store.setHydrated()
    return { ok: true }
  }
  try {
    const doc = migrate(raw)
    store.replaceDoc(doc)
    store.setSync({ status: 'saved', lastSavedAt: doc.updatedAt, message: null })
    store.setHydrated()
    return { ok: true }
  } catch (e) {
    // keep a copy so the next save does not destroy the only version
    writeJson(`${KEYS.doc}.unreadable-${Date.now()}`, raw)
    store.setHydrated()
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function writeCache(): boolean {
  const { doc } = useTracker.getState()
  return writeJson(KEYS.doc, doc)
}

/** Save immediately (Ctrl+S, Save button, before unload). */
export function saveNow(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const store = useTracker.getState()
  const pending = store.pendingChanges.length
  const ok = writeCache()
  const mode = loadConnection().mode
  if (!ok) {
    store.setSync({
      status: 'error',
      message:
        'Could not write to browser storage (private window or storage full?). Export a JSON backup.',
    })
    return
  }
  if (mode === 'local') {
    store.clearPending(pending)
    store.setSync({ status: 'saved', lastSavedAt: new Date().toISOString(), message: null })
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(saveNow, LOCAL_DEBOUNCE_MS)
}

export function startAutoPersist(): () => void {
  if (started) return () => {}
  started = true
  const unsub = useTracker.subscribe((s, prev) => {
    if (s.doc !== prev.doc && s.hydrated) {
      if (s.sync.status !== 'unsaved') useTracker.getState().setSync({ status: 'unsaved' })
      schedule()
    }
  })
  const onUnload = () => {
    if (timer) saveNow()
  }
  window.addEventListener('beforeunload', onUnload)
  return () => {
    unsub()
    window.removeEventListener('beforeunload', onUnload)
    started = false
  }
}
