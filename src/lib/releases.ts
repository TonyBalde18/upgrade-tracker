/** ServiceNow release (family) names and their optional logos. */
import { FAMILY_SUGGESTIONS } from '@/lib/model/defaults'
import type { Settings, TrackerDoc } from '@/lib/model/types'

const key = (name: string) => name.trim().toLowerCase()

/** The logo for a release, matched case-insensitively ("brazil" finds "Brazil"). */
export function releaseLogoOf(
  settings: Pick<Settings, 'releaseLogos'>,
  family: string,
): string | undefined {
  const logos = settings.releaseLogos
  if (!logos || !family.trim()) return undefined
  if (logos[family]) return logos[family]
  const k = key(family)
  for (const [name, logo] of Object.entries(logos)) if (key(name) === k) return logo
  return undefined
}

/**
 * Releases to list in Settings: the known ones, those used by any upgrade and those
 * that have a logo. Oldest first as in FAMILY_SUGGESTIONS, then the rest A-Z; no duplicates.
 */
export function knownReleases(doc: Pick<TrackerDoc, 'upgrades' | 'settings'>): string[] {
  const seen = new Map<string, string>()
  const add = (n: string) => {
    const name = n.trim().replace(/\s+/g, ' ')
    if (name && !seen.has(key(name))) seen.set(key(name), name)
  }
  FAMILY_SUGGESTIONS.forEach(add)
  const extra = [
    ...doc.upgrades.flatMap((u) => [u.fromFamily, u.family]),
    ...Object.keys(doc.settings.releaseLogos ?? {}),
  ]
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(key(n)))
    .sort((a, b) => a.localeCompare(b))
  extra.forEach(add)
  return [...seen.values()]
}

/** New releaseLogos map with `logo` set (or removed when undefined) for `family`. */
export function withReleaseLogo(
  logos: Record<string, string> | undefined,
  family: string,
  logo: string | undefined,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [name, v] of Object.entries(logos ?? {})) if (key(name) !== key(family)) next[name] = v
  if (logo) next[family.trim()] = logo
  return next
}
