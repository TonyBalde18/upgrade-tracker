/**
 * Thin, failure-proof wrapper around localStorage. Every access is wrapped in
 * try/catch (private windows, quota, blocked storage). Never stores secrets in
 * anything but the token key, and never logs values.
 */
const PREFIX = 'upgrade-tracker:'

export const KEYS = {
  doc: 'doc',
  connection: 'connection',
  token: 'token',
  ui: 'ui',
} as const

export function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, value)
    return true
  } catch {
    return false
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: string): T | null {
  const s = readString(key)
  if (s == null) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value))
  } catch {
    return false
  }
}
