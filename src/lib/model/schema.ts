import { z } from 'zod'
import { toneNames } from '@/theme/brand'
import { PHASES, SCHEMA_VERSION, type TrackerDoc } from './types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'expected YYYY-MM-DDTHH:mm')
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:mm')

const statusDef = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  tone: z.enum(toneNames),
  category: z.enum(['planned', 'confirmed', 'active', 'done', 'blocked', 'cancelled', 'na']),
})

const settings = z.object({
  displayTimeZone: z.string(),
  defaultWindowTimeZone: z.string(),
  weekStartsMonday: z.boolean(),
  reducedMotion: z.enum(['system', 'on', 'off']),
  theme: z.enum(['system', 'light', 'dark']),
  defaultWindowDurationHours: z.number().positive(),
  owners: z.array(z.string()),
  assignees: z.array(z.string()),
  scheduleStatuses: z.array(statusDef).min(1),
  windowStatuses: z.array(statusDef).min(1),
  taskStatuses: z.array(statusDef).min(1),
})

const customer = z.object({
  id: z.string().min(1),
  name: z.string(),
  shortName: z.string(),
  color: z.string(),
  snContact: z.string(),
  consultants: z.array(z.string()),
  instances: z.object({ dev: z.string(), uat: z.string(), prod: z.string() }),
  notes: z.string(),
  active: z.boolean(),
})

const phase = z.enum(['Preparation', 'DEV', 'UAT', 'Go-live', 'PROD', 'Hypercare'])
// keep in step with PHASES
void PHASES
const env = z.enum(['dev', 'uat', 'prod'])
const kind = z.enum(['task', 'milestone'])

const step = z.object({
  id: z.string().min(1),
  name: z.string(),
  phase,
  defaultOwner: z.string(),
  defaultAssignee: z.string(),
  anchor: env,
  offsetDays: z.number().int(),
  durationDays: z.number().int().min(1),
  kind,
  avoidWeekend: z.boolean(),
  timeMode: z.enum(['none', 'window', 'fixed']),
  fixedTime: hhmm.nullable(),
})

const window = z.object({
  start: localDateTime,
  timeZone: z.string(),
  durationHours: z.number().positive(),
  status: z.string(),
  updatedAt: z.string(),
})

const task = z.object({
  id: z.string().min(1),
  templateStepId: z.string().nullable(),
  name: z.string(),
  phase,
  kind,
  owner: z.string(),
  assignee: z.string(),
  status: z.string(),
  start: isoDate.nullable(),
  end: isoDate.nullable(),
  time: z.object({ start: hhmm, end: hhmm.nullable(), timeZone: z.string() }).nullable(),
  datesManuallySet: z.boolean(),
  notes: z.string(),
  link: z.string(),
  order: z.number(),
  updatedAt: z.string(),
})

const upgrade = z.object({
  id: z.string().min(1),
  customerId: z.string(),
  family: z.string(),
  fromFamily: z.string(),
  cycle: z.string(),
  scheduleStatus: z.string(),
  snCaseUrl: z.string(),
  notes: z.string(),
  windows: z.object({ dev: window, uat: window.nullable(), prod: window }),
  tasks: z.array(task),
  canvas: z.object({
    nodePositions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
  }),
  log: z.array(z.object({ at: z.string(), text: z.string(), kind: z.enum(['auto', 'note']) })),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const trackerDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.string(),
  settings,
  customers: z.array(customer),
  template: z.object({ steps: z.array(step) }),
  upgrades: z.array(upgrade),
})

// Compile-time check that the validator and the TypeScript model agree.
type Parsed = z.infer<typeof trackerDocSchema>
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
export const _schemaMatchesModel: AssertEqual<Parsed, TrackerDoc> = true
