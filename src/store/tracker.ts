/**
 * The app's data store.
 *  - `doc` is the whole tracker.json document (immutable updates via Immer, so
 *    unchanged parts keep their identity and memoised views do not re-render).
 *  - Undo/redo (zundo) records `doc` only.
 *  - Every edit goes through `commit(description, recipe)`. The description is
 *    collected for the next save's commit message.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import { useStore } from 'zustand'
import type { Draft } from 'immer'
import { emptyDoc } from '@/lib/model/defaults'
import type { Customer, Settings, StatusDef, StatusListKey, TrackerDoc } from '@/lib/model/types'
import { newId } from '@/lib/id'
import { customerColors } from '@/theme/brand'

export type SyncStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  message: string | null
  lastSavedAt: string | null
}

interface CommitOptions {
  /** false = do not create an undo step (e.g. theme toggle) */
  history?: boolean
}

export interface TrackerState {
  doc: TrackerDoc
  hydrated: boolean
  sync: SyncState
  /** human-readable edits since the last successful save */
  pendingChanges: string[]

  commit: (
    description: string,
    recipe: (doc: Draft<TrackerDoc>) => void,
    opts?: CommitOptions,
  ) => void
  /** Replace the whole document (load, import, demo). Clears undo history. */
  replaceDoc: (doc: TrackerDoc, opts?: { dirty?: boolean; description?: string }) => void
  setHydrated: () => void
  setSync: (patch: Partial<SyncState>) => void
  clearPending: (count: number) => void

  // settings
  updateSettings: (patch: Partial<Settings>, description?: string, opts?: CommitOptions) => void
  addStatus: (list: StatusListKey, def: Omit<StatusDef, 'id'>) => void
  updateStatus: (list: StatusListKey, id: string, patch: Partial<Omit<StatusDef, 'id'>>) => void
  deleteStatus: (list: StatusListKey, id: string, replacementId: string) => void
  moveStatus: (list: StatusListKey, id: string, direction: -1 | 1) => void

  /** Rename an owner/assignee everywhere it is used (list, template defaults, tasks). */
  renamePerson: (kind: 'owners' | 'assignees', from: string, to: string) => void

  // customers
  addCustomers: (names: string[]) => number
  upsertCustomer: (c: Customer) => void
}

const LIST_LABEL: Record<StatusListKey, string> = {
  scheduleStatuses: 'schedule status',
  windowStatuses: 'window status',
  taskStatuses: 'task status',
}

let historyPaused = false

export const useTracker = create<TrackerState>()(
  temporal(
    immer((set, get) => ({
      doc: emptyDoc(),
      hydrated: false,
      sync: { status: 'idle', message: null, lastSavedAt: null },
      pendingChanges: [],

      commit(description, recipe, opts) {
        const t = useTracker.temporal.getState()
        const skipHistory = opts?.history === false
        if (skipHistory) t.pause()
        set((s) => {
          recipe(s.doc)
          s.doc.updatedAt = new Date().toISOString()
          s.pendingChanges.push(description)
        })
        if (skipHistory && !historyPaused) t.resume()
      },

      replaceDoc(doc, opts) {
        const t = useTracker.temporal.getState()
        t.pause()
        set((s) => {
          s.doc = doc
          s.pendingChanges = opts?.dirty && opts.description ? [opts.description] : []
        })
        t.clear()
        t.resume()
      },

      setHydrated() {
        set((s) => {
          s.hydrated = true
        })
      },

      // `doc` does not change here, so zundo's equality check records no undo step
      setSync(patch) {
        set((s) => {
          Object.assign(s.sync, patch)
        })
      },

      clearPending(count) {
        set((s) => {
          s.pendingChanges.splice(0, count)
        })
      },

      updateSettings(patch, description, opts) {
        get().commit(
          description ?? `Settings: ${Object.keys(patch).join(', ')}`,
          (d) => {
            Object.assign(d.settings, patch)
          },
          opts,
        )
      },

      addStatus(list, def) {
        get().commit(`Add ${LIST_LABEL[list]} "${def.label}"`, (d) => {
          d.settings[list].push({ ...def, id: newId('st') })
        })
      },

      updateStatus(list, id, patch) {
        const current = get().doc.settings[list].find((s) => s.id === id)
        get().commit(`Edit ${LIST_LABEL[list]} "${patch.label ?? current?.label ?? id}"`, (d) => {
          const s = d.settings[list].find((x) => x.id === id)
          if (s) Object.assign(s, patch)
        })
      },

      deleteStatus(list, id, replacementId) {
        const current = get().doc.settings[list].find((s) => s.id === id)
        get().commit(`Delete ${LIST_LABEL[list]} "${current?.label ?? id}"`, (d) => {
          d.settings[list] = d.settings[list].filter((s) => s.id !== id)
          for (const u of d.upgrades) {
            if (list === 'scheduleStatuses' && u.scheduleStatus === id)
              u.scheduleStatus = replacementId
            if (list === 'windowStatuses') {
              for (const w of [u.windows.dev, u.windows.uat, u.windows.prod]) {
                if (w && w.status === id) w.status = replacementId
              }
            }
            if (list === 'taskStatuses') {
              for (const t of u.tasks) if (t.status === id) t.status = replacementId
            }
          }
        })
      },

      moveStatus(list, id, direction) {
        get().commit(`Reorder ${LIST_LABEL[list]}`, (d) => {
          const arr = d.settings[list]
          const i = arr.findIndex((s) => s.id === id)
          const j = i + direction
          if (i < 0 || j < 0 || j >= arr.length) return
          const [item] = arr.splice(i, 1)
          if (item) arr.splice(j, 0, item)
        })
      },

      renamePerson(kind, from, to) {
        const name = to.trim()
        if (!name || name === from) return
        get().commit(
          `Rename ${kind === 'owners' ? 'owner' : 'assignee'} "${from}" → "${name}"`,
          (d) => {
            d.settings[kind] = d.settings[kind].map((x) => (x === from ? name : x))
            for (const s of d.template.steps) {
              if (kind === 'owners' && s.defaultOwner === from) s.defaultOwner = name
              if (kind === 'assignees' && s.defaultAssignee === from) s.defaultAssignee = name
            }
            for (const u of d.upgrades) {
              for (const t of u.tasks) {
                if (kind === 'owners' && t.owner === from) t.owner = name
                if (kind === 'assignees' && t.assignee === from) t.assignee = name
              }
            }
          },
        )
      },

      addCustomers(names) {
        const seen = new Set(get().doc.customers.map((c) => c.name.trim().toLowerCase()))
        const clean: string[] = []
        for (const raw of names) {
          const n = raw.trim().replace(/\s+/g, ' ')
          if (!n || seen.has(n.toLowerCase())) continue
          seen.add(n.toLowerCase())
          clean.push(n)
        }
        if (clean.length === 0) return 0
        const offset = get().doc.customers.length
        get().commit(`Add ${clean.length} customer${clean.length > 1 ? 's' : ''}`, (d) => {
          clean.forEach((name, i) => {
            d.customers.push({
              id: newId('cus'),
              name,
              shortName: shortNameOf(name),
              color: customerColors[(offset + i) % customerColors.length] ?? '#94A3B8',
              snContact: '',
              consultants: [],
              instances: { dev: '', uat: '', prod: '' },
              notes: '',
              active: true,
            })
          })
        })
        return clean.length
      },

      upsertCustomer(c) {
        const exists = get().doc.customers.some((x) => x.id === c.id)
        get().commit(`${exists ? 'Edit' : 'Add'} customer ${c.name}`, (d) => {
          const i = d.customers.findIndex((x) => x.id === c.id)
          if (i >= 0) d.customers[i] = c
          else d.customers.push(c)
        })
      },
    })),
    {
      partialize: (s) => ({ doc: s.doc }),
      equality: (a, b) => a.doc === b.doc,
      limit: 100,
    },
  ),
)

/** "Northwind Traders" -> "NT", "Acme Corp" -> "AC", "Globex" -> "GLO" */
export function shortNameOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2)
    return words
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
  return name.slice(0, 3).toUpperCase()
}

// --- undo / redo -------------------------------------------------------------

export function undo(): void {
  const t = useTracker.temporal.getState()
  if (t.pastStates.length === 0) return
  t.undo()
  useTracker.setState((s) => {
    s.pendingChanges.push('Undo')
  })
}

export function redo(): void {
  const t = useTracker.temporal.getState()
  if (t.futureStates.length === 0) return
  t.redo()
  useTracker.setState((s) => {
    s.pendingChanges.push('Redo')
  })
}

export function useHistory(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useStore(useTracker.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useTracker.temporal, (s) => s.futureStates.length > 0)
  return { canUndo, canRedo }
}

/** Run a function without recording undo history (used by persistence when loading). */
export function withoutHistory(fn: () => void): void {
  const t = useTracker.temporal.getState()
  historyPaused = true
  t.pause()
  try {
    fn()
  } finally {
    historyPaused = false
    t.resume()
  }
}

// --- selectors ---------------------------------------------------------------

export const useDoc = () => useTracker((s) => s.doc)
export const useSettings = () => useTracker((s) => s.doc.settings)
export const useCustomers = () => useTracker((s) => s.doc.customers)
export const useUpgrades = () => useTracker((s) => s.doc.upgrades)
