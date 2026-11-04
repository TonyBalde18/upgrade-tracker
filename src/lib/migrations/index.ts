/**
 * Loads any stored / imported document and brings it to the current schema.
 *
 * To change the data model later:
 *  1. bump SCHEMA_VERSION in model/types.ts
 *  2. add a function to MIGRATIONS below that converts version N to N+1
 *  3. update model/schema.ts and add a test in migrations.test.ts
 */
import { trackerDocSchema } from '@/lib/model/schema'
import { defaultSettings, defaultTemplate } from '@/lib/model/defaults'
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
  // 1: (doc) => ({ ...doc, schemaVersion: 2, newField: ... }),
}

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Fill in fields that are missing (e.g. a hand-edited file) without touching existing values. */
function normalize(doc: Json): Json {
  const settings = isObject(doc.settings) ? doc.settings : {}
  const template = isObject(doc.template) ? doc.template : {}
  return {
    ...doc,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date().toISOString(),
    settings: { ...defaultSettings(), ...settings },
    customers: Array.isArray(doc.customers) ? doc.customers : [],
    template: Array.isArray(template.steps) ? template : defaultTemplate(),
    upgrades: Array.isArray(doc.upgrades) ? doc.upgrades : [],
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
