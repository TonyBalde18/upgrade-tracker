/**
 * Loads any stored / imported document and brings it to the current schema.
 *
 * To change the data model later:
 *  1. bump SCHEMA_VERSION in model/types.ts
 *  2. add a function to MIGRATIONS below that converts version N to N+1
 *  3. update model/schema.ts and add a test in migrations.test.ts
 */
import { trackerDocSchema } from '@/lib/model/schema'
import {
  DEFAULT_ENV_NAMES,
  defaultSettings,
  defaultTemplate,
  newGoNoGo,
} from '@/lib/model/defaults'
import { SCHEMA_VERSION, type TrackerDoc } from '@/lib/model/types'

type Json = Record<string, unknown>

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

/** Each entry converts a document of version `key` into version `key + 1`. */
const MIGRATIONS: Record<number, (doc: Json) => Json> = {
  1: v1to2,
}

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isObject) : [])
const FREEZE = /freeze/i

/**
 * Version 2:
 *  - upgrade statuses become one approval flow: Proposed, Pending approval (was
 *    Requested), Approved (was Confirmed and Customer confirmed start)...
 *  - freeze steps are multi-day steps instead of one-day milestones
 *  - the template names the test environment "{test}" so each customer's own name
 *    (UAT, TEST, STAG, PRP) is used in new plans
 *  - Go / No-Go is recorded as Go on windows that are already done
 *  - each customer's current release is taken from their last finished upgrade
 * New fields (people, envNames, extra windows, documents...) are filled by normalize().
 */
function v1to2(doc: Json): Json {
  const settings = isObject(doc.settings) ? { ...doc.settings } : {}
  let statuses = list(settings.scheduleStatuses).map((st) => ({ ...st }))
  const ids = new Set(statuses.map((st) => st.id))
  const relabel = (id: string, from: string, to: string) => {
    const st = statuses.find((x) => x.id === id)
    if (st && st.label === from) st.label = to
  }
  relabel('ss-requested', 'Requested', 'Pending approval')
  relabel('ss-confirmed', 'Confirmed', 'Approved')
  const merge = ids.has('ss-customer-start') && ids.has('ss-confirmed')
  if (merge) statuses = statuses.filter((st) => st.id !== 'ss-customer-start')
  if (statuses.length && !ids.has('ss-proposed'))
    statuses.unshift({ id: 'ss-proposed', label: 'Proposed', tone: 'slate', category: 'planned' })
  if (statuses.length) settings.scheduleStatuses = statuses

  const doneWindow = new Set(
    list(settings.windowStatuses)
      .filter((st) => st.category === 'done')
      .map((st) => st.id),
  )
  const doneUpgrade = new Set(statuses.filter((st) => st.category === 'done').map((st) => st.id))

  const template = isObject(doc.template) ? doc.template : null
  const steps = template
    ? list(template.steps).map((st) => ({
        ...st,
        name: typeof st.name === 'string' ? st.name.replace(/\bUAT\b/g, '{test}') : st.name,
        kind: FREEZE.test(String(st.name)) ? 'task' : st.kind,
      }))
    : null

  const upgrades = list(doc.upgrades).map((u): Json => {
    const windows = isObject(u.windows) ? { ...u.windows } : u.windows
    if (isObject(windows))
      for (const env of ['dev', 'uat', 'prod']) {
        const w = windows[env]
        if (isObject(w) && !isObject(w.goNoGo))
          windows[env] = {
            ...w,
            goNoGo: doneWindow.has(String(w.status))
              ? { decision: 'go', date: null, by: '' }
              : newGoNoGo(),
          }
      }
    return {
      ...u,
      scheduleStatus:
        merge && u.scheduleStatus === 'ss-customer-start' ? 'ss-confirmed' : u.scheduleStatus,
      windows,
      tasks: list(u.tasks).map((t) =>
        t.kind === 'milestone' && FREEZE.test(String(t.name)) ? { ...t, kind: 'task' } : t,
      ),
    }
  })

  const customers = list(doc.customers).map((c) => {
    if (typeof c.currentRelease === 'string') return c
    const last = upgrades
      .filter((u) => u.customerId === c.id && doneUpgrade.has(String(u.scheduleStatus)))
      .map((u) => ({
        family: String(u.family ?? ''),
        at: prodStart(u),
      }))
      .sort((a, b) => b.at.localeCompare(a.at))[0]
    return { ...c, currentRelease: last?.family ?? '' }
  })

  return {
    ...doc,
    schemaVersion: 2,
    settings,
    ...(template && steps ? { template: { ...template, steps } } : {}),
    customers,
    upgrades,
  }
}

const prodStart = (u: Json): string => {
  const w = isObject(u.windows) ? u.windows.prod : null
  return isObject(w) && typeof w.start === 'string' ? w.start : ''
}

/** Fill fields added in later versions (also for parts written by an older app). */
function normalizeCustomer(c: Json): Json {
  const names = isObject(c.envNames) ? c.envNames : {}
  return {
    currentRelease: '',
    currentPatch: '',
    releaseCheckedAt: null,
    documents: [],
    ...c,
    envNames: { ...DEFAULT_ENV_NAMES, ...names },
  }
}

function normalizeWindow(w: unknown): unknown {
  return isObject(w) && !isObject(w.goNoGo) ? { ...w, goNoGo: newGoNoGo() } : w
}

function normalizeUpgrade(u: Json): Json {
  const windows = isObject(u.windows)
    ? {
        ...u.windows,
        dev: normalizeWindow(u.windows.dev),
        uat: normalizeWindow(u.windows.uat ?? null),
        prod: normalizeWindow(u.windows.prod),
      }
    : u.windows
  return {
    documents: [],
    lessonsLearned: '',
    ...u,
    windows,
    extraWindows: list(u.extraWindows).map((x) => normalizeWindow(x)),
    tasks: Array.isArray(u.tasks)
      ? u.tasks.map((t) =>
          isObject(t) && typeof t.assignedTo !== 'string' ? { ...t, assignedTo: '' } : t,
        )
      : u.tasks,
  }
}

/** Fill in fields that are missing (e.g. a hand-edited file) without touching existing values. */
function normalize(doc: Json): Json {
  const settings = isObject(doc.settings) ? doc.settings : {}
  const template = isObject(doc.template) ? doc.template : {}
  return {
    ...doc,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date().toISOString(),
    settings: { ...defaultSettings(), ...settings },
    customers: Array.isArray(doc.customers)
      ? doc.customers.map((c) => (isObject(c) ? normalizeCustomer(c) : c))
      : [],
    template: Array.isArray(template.steps) ? template : defaultTemplate(),
    upgrades: Array.isArray(doc.upgrades)
      ? doc.upgrades.map((u) => (isObject(u) ? normalizeUpgrade(u) : u))
      : [],
  }
}

export function migrate(raw: unknown): TrackerDoc {
  if (!isObject(raw))
    throw new MigrationError('The file is not a tracker document (expected a JSON object).')
  let doc: Json = raw
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1
  if (version > SCHEMA_VERSION) {
    throw new MigrationError(
      `This data was saved by a newer version of the app (schema ${version}). Update the app first.`,
    )
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new MigrationError(`No migration from schema ${version}.`)
    doc = step(doc)
    version++
  }
  doc = normalize({ ...doc, schemaVersion: SCHEMA_VERSION })
  const parsed = trackerDocSchema.safeParse(doc)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path.join('.') || 'document'
    throw new MigrationError(`Invalid data at "${where}": ${first?.message ?? 'unknown error'}`)
  }
  return parsed.data
}

/** Parse JSON text (e.g. an imported file) into a valid document. */
export function parseDocText(text: string): TrackerDoc {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new MigrationError('The file is not valid JSON.')
  }
  return migrate(raw)
}
