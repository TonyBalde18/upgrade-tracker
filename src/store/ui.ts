/** Per-browser UI state (not part of tracker.json). */
import { create } from 'zustand'
import { KEYS, readJson, writeJson } from '@/lib/storage/local'

interface PersistedUi {
  sidebarCollapsed: boolean
}

interface UiState extends PersistedUi {
  paletteOpen: boolean
  paletteQuery: string
  newUpgradeOpen: boolean
  /** customer to preselect in the New upgrade flow */
  newUpgradeCustomerId: string | null
  toggleSidebar: () => void
  openPalette: (query?: string) => void
  setPaletteOpen: (open: boolean) => void
  setNewUpgradeOpen: (open: boolean, customerId?: string) => void
}

const stored = readJson<Partial<PersistedUi>>(KEYS.ui) ?? {}

export const useUi = create<UiState>()((set, get) => ({
  sidebarCollapsed: stored.sidebarCollapsed ?? false,
  paletteOpen: false,
  paletteQuery: '',
  newUpgradeOpen: false,
  newUpgradeCustomerId: null,
  toggleSidebar() {
    const sidebarCollapsed = !get().sidebarCollapsed
    set({ sidebarCollapsed })
    writeJson(KEYS.ui, { sidebarCollapsed })
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
