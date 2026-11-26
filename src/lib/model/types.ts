/**
 * Domain model for tracker.json (schemaVersion 2).
 * The runtime validator lives in schema.ts; keep both in sync.
 */
import type { Tone } from '@/theme/brand'

export const SCHEMA_VERSION = 2

/** ISO calendar date, "2026-11-23" */
export type IsoDate = string
/** ISO local date-time without offset, "2026-11-23T00:15" (meaning depends on a time zone) */
export type LocalDateTime = string
/** "HH:mm", 24 h */
export type HHmm = string
/** IANA time zone, e.g. "Europe/Zurich" */
export type TimeZone = string

/**
 * The three standard environments by role. "uat" is the test environment; each
 * customer names it (UAT, TEST, STAG, PRP...) in Customer.envNames.
 */
export type EnvKey = 'dev' | 'uat' | 'prod'
export const ENV_KEYS: readonly EnvKey[] = ['dev', 'uat', 'prod']

/**
 * Every status (schedule, window, task) belongs to a fixed category. Users can
 * rename, recolour, add and delete statuses; the app logic only looks at the category.
 */
export type StatusCategory =
  | 'planned' // proposed / not started
  | 'confirmed' // agreed, not started
  | 'active' // in progress
  | 'done'
  | 'blocked'
  | 'cancelled'
  | 'na'

export interface StatusDef {
  id: string
  label: string
  tone: Tone
  category: StatusCategory
}

export type StatusListKey = 'scheduleStatuses' | 'windowStatuses' | 'taskStatuses'

export type ThemePref = 'system' | 'light' | 'dark'
export type MotionPref = 'system' | 'on' | 'off'

export interface Settings {
  displayTimeZone: TimeZone
  defaultWindowTimeZone: TimeZone
  weekStartsMonday: boolean
  reducedMotion: MotionPref
  theme: ThemePref
  defaultWindowDurationHours: number
  owners: string[]
  assignees: string[]
  /** people a step can be assigned to ("Assigned to"), managed in Settings */
  people: string[]
  scheduleStatuses: StatusDef[]
  windowStatuses: StatusDef[]
  taskStatuses: StatusDef[]
  /**
   * Logo per ServiceNow release ("Australia" -> small raster data URL), set in Settings.
   * Optional: documents without it are valid. Looked up case-insensitively.
   */
  releaseLogos?: Record<string, string>
}

export interface Customer {
  id: string
  name: string
  shortName: string
  color: string
  /** ServiceNow-side contact */
  snContact: string
  consultants: string[]
  instances: { dev: string; uat: string; prod: string }
  /** what this customer calls each environment, e.g. { uat: 'PRP' } */
  envNames: { dev: string; uat: string; prod: string }
  /** release and patch the customer runs today, kept up to date by hand */
  currentRelease: string
  currentPatch: string
  /** when the release / patch was last checked */
  releaseCheckedAt: IsoDate | null
  /** links to the customer's documents (SharePoint folder...) */
  documents: DocLink[]
  notes: string
  active: boolean
  /** small raster logo as a data URL (PNG / WebP / JPEG, max ~128 px), kept only in the private data file */
  logo?: string
}

/** A named link to a document kept elsewhere (SharePoint, Confluence...). */
export interface DocLink {
  id: string
  name: string
  url: string
}

export type Phase = 'Preparation' | 'DEV' | 'UAT' | 'Go-live' | 'PROD' | 'Hypercare'
export const PHASES: readonly Phase[] = [
  'Preparation',
  'DEV',
  'UAT',
  'Go-live',
  'PROD',
  'Hypercare',
]

export type StepKind = 'task' | 'milestone'

/**
 * How a generated task gets a time of day:
 *  - none:   date only
 *  - window: same start time and zone as its anchor window (e.g. "Upgrade PROD")
 *  - fixed:  `fixedTime` in the anchor window's zone (e.g. a call at 10:00)
 */
export type TimeMode = 'none' | 'window' | 'fixed'

export interface TemplateStep {
  id: string
  name: string
  phase: Phase
  defaultOwner: string
  defaultAssignee: string
  anchor: EnvKey
  /** calendar days before (negative) or after (positive) the anchor window */
  offsetDays: number
  durationDays: number
  kind: StepKind
  /** if the date falls on a weekend: negative offsets move to Friday, positive to Monday */
  avoidWeekend: boolean
  timeMode: TimeMode
  fixedTime: HHmm | null
}

export interface Template {
  steps: TemplateStep[]
}

export type GoNoGoDecision = 'pending' | 'go' | 'nogo'

export interface GoNoGo {
  decision: GoNoGoDecision
  /** day the decision was taken */
  date: IsoDate | null
  /** who decided */
  by: string
}

export interface UpgradeWindow {
  start: LocalDateTime
  timeZone: TimeZone
  durationHours: number
  status: string // StatusDef id from settings.windowStatuses
  /** ISO timestamp, bumped whenever the window changes (drives ICS SEQUENCE) */
  updatedAt: string
  goNoGo: GoNoGo
}

/** An additional window of one upgrade, e.g. a temporary instance. */
export interface ExtraWindow extends UpgradeWindow {
  id: string
  name: string
}

export interface TaskTime {
  start: HHmm
  end: HHmm | null
  timeZone: TimeZone
}

export interface Task {
  id: string
  templateStepId: string | null
  name: string
  phase: Phase
  kind: StepKind
  owner: string
  assignee: string
  /** person doing the step, from settings.people ("" = nobody) */
  assignedTo: string
  status: string // StatusDef id from settings.taskStatuses
  /** null when not applicable (e.g. UAT steps without a UAT window) */
  start: IsoDate | null
  end: IsoDate | null
  time: TaskTime | null
  datesManuallySet: boolean
  notes: string
  link: string
  order: number
  updatedAt: string
}

export interface LogEntry {
  at: string
  text: string
  kind: 'auto' | 'note'
}

export interface Upgrade {
  id: string
  customerId: string
  family: string
  fromFamily: string
  cycle: string
  scheduleStatus: string // StatusDef id from settings.scheduleStatuses
  snCaseUrl: string
  notes: string
  windows: { dev: UpgradeWindow; uat: UpgradeWindow | null; prod: UpgradeWindow }
  /** windows outside the standard three (temporary instance...) */
  extraWindows: ExtraWindow[]
  /** links to runbooks, smoke-test evidence... */
  documents: DocLink[]
  /** what to remember for the next upgrade of this customer */
  lessonsLearned: string
  tasks: Task[]
  canvas: { nodePositions?: Record<string, { x: number; y: number }> }
  log: LogEntry[]
  createdAt: string
  updatedAt: string
}

export interface TrackerDoc {
  schemaVersion: typeof SCHEMA_VERSION
  updatedAt: string
  settings: Settings
  customers: Customer[]
  template: Template
  upgrades: Upgrade[]
}
