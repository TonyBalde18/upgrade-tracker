import type {
  Customer,
  EnvKey,
  GoNoGo,
  Phase,
  Settings,
  StatusDef,
  StepKind,
  Template,
  TemplateStep,
  TimeMode,
  TrackerDoc,
} from './types'
import { SCHEMA_VERSION } from './types'

/**
 * One flow: Proposed -> Pending approval -> Approved -> In progress -> Done.
 * "planned" statuses are drawn striped on the timeline, "confirmed" and later solid.
 */
export const DEFAULT_SCHEDULE_STATUSES: StatusDef[] = [
  { id: 'ss-proposed', label: 'Proposed', tone: 'slate', category: 'planned' },
  { id: 'ss-requested', label: 'Pending approval', tone: 'amber', category: 'planned' },
  { id: 'ss-confirmed', label: 'Approved', tone: 'sky', category: 'confirmed' },
  {
    id: 'ss-rescheduled',
    label: 'Rescheduled (auto-upgrade)',
    tone: 'orange',
    category: 'planned',
  },
  { id: 'ss-in-progress', label: 'In progress', tone: 'violet', category: 'active' },
  { id: 'ss-done', label: 'Done', tone: 'green', category: 'done' },
  { id: 'ss-cancelled', label: 'Cancelled', tone: 'slate', category: 'cancelled' },
]

export const DEFAULT_WINDOW_STATUSES: StatusDef[] = [
  { id: 'ws-planned', label: 'Planned', tone: 'amber', category: 'planned' },
  { id: 'ws-confirmed', label: 'Confirmed', tone: 'sky', category: 'confirmed' },
  { id: 'ws-in-progress', label: 'In progress', tone: 'violet', category: 'active' },
  { id: 'ws-done', label: 'Done', tone: 'green', category: 'done' },
  { id: 'ws-cancelled', label: 'Cancelled', tone: 'slate', category: 'cancelled' },
]

export const DEFAULT_TASK_STATUSES: StatusDef[] = [
  { id: 'ts-not-started', label: 'Not Started', tone: 'slate', category: 'planned' },
  { id: 'ts-in-progress', label: 'In progress', tone: 'violet', category: 'active' },
  { id: 'ts-completed', label: 'Completed', tone: 'green', category: 'done' },
  { id: 'ts-blocked', label: 'Blocked', tone: 'red', category: 'blocked' },
  { id: 'ts-na', label: 'N/A', tone: 'slate', category: 'na' },
]

/** Categories each status list must always keep at least one status for (the logic relies on them). */
export const REQUIRED_CATEGORIES = {
  scheduleStatuses: ['planned', 'active', 'done', 'cancelled'],
  windowStatuses: ['planned', 'done'],
  taskStatuses: ['planned', 'done', 'blocked', 'na'],
} as const

/** Categories offered when adding a status to each list. */
export const ALLOWED_CATEGORIES = {
  scheduleStatuses: ['planned', 'confirmed', 'active', 'done', 'cancelled'],
  windowStatuses: ['planned', 'confirmed', 'active', 'done', 'cancelled'],
  taskStatuses: ['planned', 'active', 'done', 'blocked', 'na'],
} as const

export const DEFAULT_ENV_NAMES = { dev: 'DEV', uat: 'UAT', prod: 'PROD' } as const

/** Go / No-Go of a window before anyone decided. */
export function newGoNoGo(): GoNoGo {
  return { decision: 'pending', date: null, by: '' }
}

/** Fields of a new customer besides id, name and colour. */
export function customerDefaults(): Omit<Customer, 'id' | 'name' | 'shortName' | 'color'> {
  return {
    snContact: '',
    consultants: [],
    instances: { dev: '', uat: '', prod: '' },
    envNames: { ...DEFAULT_ENV_NAMES },
    currentRelease: '',
    currentPatch: '',
    releaseCheckedAt: null,
    documents: [],
    notes: '',
    active: true,
  }
}

export function defaultSettings(): Settings {
  return {
    displayTimeZone: 'Europe/Lisbon',
    defaultWindowTimeZone: 'Europe/Zurich',
    weekStartsMonday: true,
    reducedMotion: 'system',
    theme: 'dark',
    defaultWindowDurationHours: 3,
    owners: ['P4M', 'Client', 'P4M & Client'],
    assignees: ['SDM', 'MS team', 'Client'],
    people: [],
    scheduleStatuses: DEFAULT_SCHEDULE_STATUSES.map((s) => ({ ...s })),
    windowStatuses: DEFAULT_WINDOW_STATUSES.map((s) => ({ ...s })),
    taskStatuses: DEFAULT_TASK_STATUSES.map((s) => ({ ...s })),
  }
}

type Row = [
  name: string,
  phase: Phase,
  owner: string,
  assignee: string,
  anchor: EnvKey,
  offset: number,
  kind: StepKind,
  duration?: number,
  timeMode?: TimeMode,
]

/** The standard ServiceNow family-release upgrade plan. `{family}` is replaced by the target release. */
const STANDARD_STEPS: Row[] = [
  ['Run upgrade preview', 'Preparation', 'P4M', 'SDM', 'dev', -21, 'task'],
  ['Review upgrade planning', 'Preparation', 'P4M', 'SDM', 'dev', -18, 'task'],
  ['Prepare test scripts', 'Preparation', 'Client', 'Client', 'dev', -10, 'task'],
  ['Freeze on DEV instance', 'Preparation', 'P4M & Client', 'SDM', 'dev', -3, 'task'],
  [
    'Move all finished update sets to Prod',
    'Preparation',
    'P4M & Client',
    'MS team',
    'dev',
    -3,
    'task',
  ],
  ['Export active update sets from DEV', 'Preparation', 'P4M', 'MS team', 'dev', -2, 'task'],
  [
    'Confirm exclusion data & data-preserve on instances',
    'Preparation',
    'P4M',
    'MS team',
    'dev',
    -2,
    'task',
  ],
  ['Schedule clone from Prod to DEV', 'DEV', 'P4M & Client', 'MS team', 'dev', -1, 'milestone'],
  ['Upgrade DEV to {family} release', 'DEV', 'P4M', 'MS team', 'dev', 0, 'milestone', 1, 'window'],
  [
    'Smoke testing + review skipped records (P1 & P2)',
    'DEV',
    'P4M',
    'MS team',
    'dev',
    1,
    'task',
    3,
  ],
  ['Schedule clone from Prod to {test}', 'UAT', 'P4M', 'MS team', 'uat', -1, 'milestone'],
  [
    'Upgrade {test} to {family} release',
    'UAT',
    'P4M',
    'MS team',
    'uat',
    0,
    'milestone',
    1,
    'window',
  ],
  ['Push fix update sets to {test}', 'UAT', 'P4M', 'MS team', 'uat', 1, 'task'],
  ['User acceptance testing', 'UAT', 'Client', 'Client', 'uat', 1, 'task', 5],
  ['Fix {test} testing issues', 'UAT', 'P4M', 'MS team', 'uat', 2, 'task', 5],
  [
    'Alignment call - confirm progress on testing and fixes',
    'Go-live',
    'P4M & Client',
    'SDM',
    'prod',
    -7,
    'milestone',
  ],
  [
    'Prepare communication for end users (if applicable)',
    'Go-live',
    'Client',
    'Client',
    'prod',
    -7,
    'task',
  ],
  ['Go / No-Go call', 'Go-live', 'P4M & Client', 'SDM', 'prod', -3, 'milestone'],
  ['Restore update sets on DEV instance', 'Go-live', 'P4M & Client', 'MS team', 'prod', -2, 'task'],
  ['Client sends internal communication', 'Go-live', 'Client', 'Client', 'prod', -2, 'task'],
  [
    'Upgrade Prod to {family} release',
    'PROD',
    'P4M',
    'MS team',
    'prod',
    0,
    'milestone',
    1,
    'window',
  ],
  ['Push fix update sets to Prod', 'PROD', 'P4M', 'MS team', 'prod', 0, 'task'],
  ['Upgrade hypercare', 'Hypercare', 'P4M', 'MS team', 'prod', 1, 'task', 10],
  ['Documentation', 'Hypercare', 'P4M', 'MS team', 'prod', 3, 'task'],
]

export function defaultTemplate(): Template {
  const steps: TemplateStep[] = STANDARD_STEPS.map(
    ([name, phase, owner, assignee, anchor, offset, kind, duration = 1, timeMode = 'none'], i) => ({
      id: `step-${String(i + 1).padStart(2, '0')}`,
      name,
      phase,
      defaultOwner: owner,
      defaultAssignee: assignee,
      anchor,
      offsetDays: offset,
      durationDays: kind === 'milestone' ? 1 : duration,
      kind,
      avoidWeekend: offset !== 0,
      timeMode,
      fixedTime: null,
    }),
  )
  return { steps }
}

export function emptyDoc(now: Date = new Date()): TrackerDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    settings: defaultSettings(),
    customers: [],
    template: defaultTemplate(),
    upgrades: [],
  }
}

/** Known ServiceNow family releases, newest last. Used for suggestions only; free text is allowed. */
export const FAMILY_SUGGESTIONS = [
  'Washington DC',
  'Xanadu',
  'Yokohama',
  'Zurich',
  'Australia',
  'Brazil',
]
