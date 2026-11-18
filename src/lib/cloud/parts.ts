/**
 * The tracker document is stored in Firestore as several small records ("parts")
 * instead of one big file:
 *   core        settings, template, and the order of customers and upgrades
 *   c_<id>      one per customer (including its logo)
 *   u_<id>      one per upgrade (windows, tasks, log)
 * A Firestore record is limited to 1 MiB; splitting keeps every part far below it,
 * and two devices editing different customers or upgrades never overwrite each other.
 *
 * Each part is stored as a JSON string, so Firestore never has to understand (or
 * reject) the shape of the data. Everything here is pure and unit-tested.
 */
import { migrate } from '@/lib/migrations'
import { SCHEMA_VERSION, type Customer, type TrackerDoc, type Upgrade } from '@/lib/model/types'

export type Parts = Map<string, string>

export const CORE_ID = 'core'
const CUSTOMER = 'c_'
const UPGRADE = 'u_'

/** Firestore's limit is 1 MiB per record; stay well below it. */
export const MAX_PART_CHARS = 900_000

interface CorePart {
  schemaVersion: number
  updatedAt: string
  settings: TrackerDoc['settings']
  template: TrackerDoc['template']
  customerOrder: string[]
  upgradeOrder: string[]
}

export function splitDoc(doc: TrackerDoc): Parts {
  const parts: Parts = new Map()
  const core: CorePart = {
    schemaVersion: doc.schemaVersion,
    updatedAt: doc.updatedAt,
    settings: doc.settings,
    template: doc.template,
    customerOrder: doc.customers.map((c) => c.id),
    upgradeOrder: doc.upgrades.map((u) => u.id),
  }
  parts.set(CORE_ID, JSON.stringify(core))
  for (const c of doc.customers) parts.set(CUSTOMER + c.id, JSON.stringify(c))
  for (const u of doc.upgrades) parts.set(UPGRADE + u.id, JSON.stringify(u))
  return parts
}

function ordered<T>(byId: Map<string, T>, order: string[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const v = byId.get(id)
    if (v !== undefined && !seen.has(id)) {
      out.push(v)
      seen.add(id)
    }
  }
  // parts added elsewhere that the core's order does not know yet
  for (const id of [...byId.keys()].sort()) if (!seen.has(id)) out.push(byId.get(id) as T)
  return out
}

/**
 * Rebuild the document from its parts, then validate and migrate it like any loaded file.
 * Returns null when there is nothing stored yet. Throws MigrationError / SyntaxError
 * when the stored data is unreadable.
 */
export function joinParts(parts: Parts): TrackerDoc | null {
  if (parts.size === 0) return null
  const coreText = parts.get(CORE_ID)
  const core: Partial<CorePart> = coreText ? (JSON.parse(coreText) as CorePart) : {}
  const customers = new Map<string, Customer>()
  const upgrades = new Map<string, Upgrade>()
  for (const [id, text] of parts) {
    if (id.startsWith(CUSTOMER)) customers.set(id.slice(CUSTOMER.length), JSON.parse(text))
    else if (id.startsWith(UPGRADE)) upgrades.set(id.slice(UPGRADE.length), JSON.parse(text))
  }
  return migrate({
    schemaVersion: core.schemaVersion ?? SCHEMA_VERSION,
    updatedAt: core.updatedAt,
    settings: core.settings,
    template: core.template,
    customers: ordered(customers, core.customerOrder ?? []),
    upgrades: ordered(upgrades, core.upgradeOrder ?? []),
  })
}

/**
 * Three-way merge per part.
 *  base:   what the server had the last time we looked
 *  local:  what this browser has now
 *  remote: what the server has now
 * A part changed in this browser (local differs from base) keeps the local version;
 * every other part takes the remote version (including additions and deletions).
 */
export function mergeParts(base: Parts, local: Parts, remote: Parts): Parts {
  const out: Parts = new Map()
  const ids = new Set([...base.keys(), ...local.keys(), ...remote.keys()])
  for (const id of ids) {
    const l = local.get(id)
    const changedHere = l !== base.get(id)
    const v = changedHere ? l : remote.get(id)
    if (v !== undefined) out.set(id, v)
  }
  return out
}

export interface PartsDiff {
  set: [string, string][]
  remove: string[]
}

/** What has to be written so that the server (`from`) matches `to`. */
export function diffParts(from: Parts, to: Parts): PartsDiff {
  const set: [string, string][] = []
  const remove: string[] = []
  for (const [id, v] of to) if (from.get(id) !== v) set.push([id, v])
  for (const id of from.keys()) if (!to.has(id)) remove.push(id)
  return { set, remove }
}

export function sameParts(a: Parts, b: Parts): boolean {
  if (a.size !== b.size) return false
  for (const [id, v] of a) if (b.get(id) !== v) return false
  return true
}

/** Human-readable name of a part, for error messages. */
export function describePart(id: string, doc: TrackerDoc): string {
  if (id === CORE_ID) return 'settings and template'
  if (id.startsWith(CUSTOMER)) {
    const c = doc.customers.find((x) => x.id === id.slice(CUSTOMER.length))
    return `customer ${c?.name ?? id}`
  }
  const u = doc.upgrades.find((x) => x.id === id.slice(UPGRADE.length))
  const c = u && doc.customers.find((x) => x.id === u.customerId)
  return `upgrade ${c?.name ?? ''} ${u?.family ?? id}`.replace(/\s+/g, ' ').trim()
}
