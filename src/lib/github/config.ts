/**
 * Where the data lives. This is per-browser (localStorage), never part of tracker.json.
 * The token is stored under its own key so it can be forgotten independently.
 */
import { KEYS, readJson, readString, remove, writeJson, writeString } from '@/lib/storage/local'

export type DataMode = 'local' | 'github'

export interface ConnectionConfig {
  mode: DataMode
  owner: string
  repo: string
  branch: string
  path: string
}

export const DEFAULT_CONNECTION: ConnectionConfig = {
  mode: 'local',
  owner: 'TonyBalde18',
  repo: 'upgrade-tracker-data',
  branch: 'main',
  path: 'tracker.json',
}

export function loadConnection(): ConnectionConfig {
  const stored = readJson<Partial<ConnectionConfig>>(KEYS.connection)
  return { ...DEFAULT_CONNECTION, ...(stored ?? {}) }
}

export function saveConnection(c: ConnectionConfig): void {
  writeJson(KEYS.connection, c)
}

export function loadToken(): string {
  return readString(KEYS.token) ?? ''
}

export function saveToken(token: string): void {
  writeString(KEYS.token, token.trim())
}

export function forgetToken(): void {
  remove(KEYS.token)
}

/** "github_pat_11AB…wxyz" style mask for display. */
export function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 10) return '•'.repeat(token.length)
  return `${token.slice(0, 7)}${'•'.repeat(12)}${token.slice(-4)}`
}
