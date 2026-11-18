/**
 * Data left in this browser by the previous version of the app (before Firebase).
 * Onboarding offers to upload it once; afterwards it is removed.
 */
import { migrate } from '@/lib/migrations'
import type { TrackerDoc } from '@/lib/model/types'
import { KEYS, readJson, remove } from './local'

export function readLegacyDoc(): TrackerDoc | null {
  const raw = readJson<unknown>(KEYS.legacyDoc)
  if (raw == null) return null
  try {
    const d = migrate(raw)
    return d.customers.length > 0 || d.upgrades.length > 0 ? d : null
  } catch {
    return null
  }
}

export function forgetLegacyDoc(): void {
  remove(KEYS.legacyDoc)
}
