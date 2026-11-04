import { create } from 'zustand'
import {
  forgetToken as forgetStoredToken,
  loadConnection,
  loadToken,
  saveConnection,
  saveToken,
  type ConnectionConfig,
} from '@/lib/github/config'

interface ConnectionState extends ConnectionConfig {
  hasToken: boolean
  update: (patch: Partial<ConnectionConfig>) => void
  setToken: (token: string) => void
  forgetToken: () => void
}

/** Reactive view of the per-browser connection settings. The token itself is never kept in state. */
export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  ...loadConnection(),
  hasToken: loadToken().length > 0,
  update(patch) {
    const { mode, owner, repo, branch, path } = { ...get(), ...patch }
    const next: ConnectionConfig = { mode, owner, repo, branch, path }
    saveConnection(next)
    set(next)
  },
  setToken(token) {
    saveToken(token)
    set({ hasToken: token.trim().length > 0 })
  },
  forgetToken() {
    forgetStoredToken()
    set({ hasToken: false })
  },
}))

export const useConnection = () => useConnectionStore()
