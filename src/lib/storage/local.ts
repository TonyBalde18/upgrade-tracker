/**
 * Thin, failure-proof wrapper around localStorage. Every access is wrapped in
 * try/catch (private windows, quota, blocked storage). Only small per-browser
 * preferences are stored here; the data itself lives in Firestore.
 */
const PREFIX = 'upgrade-tracker:'

export const KEYS = {
  ui: 'ui',
  /** when this browser last exported a JSON backup */
  backup: 'backup',
  /** the whole document, written by the previous (GitHub / local) version of the app */
  legacyDoc: 'doc',
} as const

/** Keys of the previous version that are no longer used (including the GitHub token). */
const RETIRED_KEYS = ['token', 'connection', 'sync']

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

/** Remove what the previous version stored and no longer needs (the old GitHub token first). */
export function removeRetiredKeys(): void {
  RETIRED_KEYS.forEach(remove)
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(`${PREFIX}${KEYS.legacyDoc}.unreadable-`)) window.localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}
