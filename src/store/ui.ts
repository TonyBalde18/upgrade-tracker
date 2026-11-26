/** Per-browser UI state (not part of tracker.json). */
import { useMemo } from 'react'
import { create } from 'zustand'
import { KEYS, readJson, writeJson } from '@/lib/storage/local'

interface PersistedUi {
  /**
   * Customers chosen in the customer filter (canvas, timeline, week). Empty means
   * "all customers". Shared by those views and remembered in this browser.
   */
  customerFilter: string[]
  /** smaller rows in the plan and the timeline */
  compact: boolean
}

interface UiState extends PersistedUi {
  paletteOpen: boolean
  paletteQuery: string
  newUpgradeOpen: boolean
  /** customer to preselect in the New upgrade flow */
  newUpgradeCustomerId: string | null
  /** calendar export dialog: one upgrade, or everything upcoming */
  icsTarget: { kind: 'upgrade'; id: string } | { kind: 'upcoming' } | null
  setIcsTarget: (t: UiState['icsTarget']) => void
  setCustomerFilter: (ids: string[]) => void
  toggleCompact: () => void
  openPalette: (query?: string) => void
  setPaletteOpen: (open: boolean) => void
  setNewUpgradeOpen: (open: boolean, customerId?: string) => void
}

const stored = readJson<Partial<PersistedUi>>(KEYS.ui) ?? {}

function persist(s: PersistedUi) {
  writeJson(KEYS.ui, { customerFilter: s.customerFilter, compact: s.compact })
}

export const useUi = create<UiState>()((set, get) => ({
  customerFilter: Array.isArray(stored.customerFilter)
    ? stored.customerFilter.filter((x): x is string => typeof x === 'string')
    : [],
  compact: stored.compact === true,
  paletteOpen: false,
  paletteQuery: '',
  newUpgradeOpen: false,
  newUpgradeCustomerId: null,
  icsTarget: null,
  setIcsTarget(icsTarget) {
    set({ icsTarget })
  },
  setCustomerFilter(customerFilter) {
    set({ customerFilter })
    persist(get())
  },
  toggleCompact() {
    set({ compact: !get().compact })
    persist(get())
  },
  openPalette(query = '') {
    set({ paletteOpen: true, paletteQuery: query })
  },
  setPaletteOpen(open) {
    set({ paletteOpen: open })
  },
  setNewUpgradeOpen(open, customerId) {
    set({ newUpgradeOpen: open, newUpgradeCustomerId: open ? (customerId ?? null) : null })
  },
}))

/**
 * The customer filter, limited to customers that still exist. A filter whose
 * customers were all deleted falls back to "all".
 */
export function useCustomerFilter(existingIds: readonly string[]): Set<string> | null {
  const ids = useUi((s) => s.customerFilter)
  const key = existingIds.join('|')
  return useMemo(() => {
    const keep = ids.filter((id) => key.split('|').includes(id))
    return keep.length ? new Set(keep) : null
  }, [ids, key])
}
