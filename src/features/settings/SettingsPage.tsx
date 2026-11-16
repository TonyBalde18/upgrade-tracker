import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  Cloud,
  Database,
  Download,
  FileUp,
  Palette,
  Clock,
  Tags,
  Trash2,
  Users,
} from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { clearAllData, exportBackup, importBackup, loadDemoData } from '@/app/actions'
import { Card, SectionTitle } from '@/components/ui/misc'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { TimeZoneSelect } from '@/components/ui/TimeZoneSelect'
import { PeopleListEditor } from './PeopleListEditor'
import { DataSection } from './DataSection'
import { StatusListEditor } from './StatusListEditor'
import { formatInZone, zoneAbbr } from '@/lib/dates'
import type { MotionPref, ThemePref } from '@/lib/model/types'

const SECTIONS = [
  { id: 'data', label: 'Data & sync', icon: Cloud },
  { id: 'backup', label: 'Backup', icon: Database },
  { id: 'time', label: 'Time & dates', icon: Clock },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'people', label: 'Owners & assignees', icon: Users },
  { id: 'statuses', label: 'Statuses', icon: Tags },
] as const

function Section({
  id,
  title,
  icon,
  children,
  description,
}: {
  id: string
  title: string
  icon: ReactNode
  description?: string
  children: ReactNode
}) {
  return (
    <motion.section
      id={`settings-${id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="scroll-mt-6"
    >
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
            {icon}
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && <p className="text-xs text-subtle">{description}</p>}
          </div>
        </div>
        {children}
      </Card>
    </motion.section>
  )
}

function BackupSection() {
  return (
    <Section
      id="backup"
      title="Backup"
      icon={<Database className="h-4 w-4" />}
      description="Works in both modes. Exports contain customer data: keep them private."
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportBackup}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
        <Button onClick={() => void importBackup()}>
          <FileUp className="h-4 w-4" /> Import JSON
        </Button>
        <Button onClick={() => void loadDemoData()}>
          <Database className="h-4 w-4" /> Load demo data
        </Button>
        <Button variant="danger" className="ml-auto" onClick={() => void clearAllData()}>
          <Trash2 className="h-4 w-4" /> Clear local data
        </Button>
      </div>
    </Section>
  )
}

function TimeSection() {
  const settings = useTracker((s) => s.doc.settings)
  const update = useTracker((s) => s.updateSettings)
  const now = new Date()
  return (
    <Section
      id="time"
      title="Time & dates"
      icon={<Clock className="h-4 w-4" />}
      description="Dates show as Mon 23 Nov 2026, times in 24 h, weeks as ISO-8601 week numbers."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Display time zone"
          hint={`Now: ${formatInZone(now, settings.displayTimeZone, 'EEE d MMM yyyy HH:mm')} ${zoneAbbr(settings.displayTimeZone)}`}
        >
          <TimeZoneSelect
            value={settings.displayTimeZone}
            onChange={(tz) => update({ displayTimeZone: tz }, `Display time zone → ${tz}`)}
          />
        </Field>
        <Field
          label="Default window time zone"
          hint="Used for new DEV / UAT / PROD windows (e.g. 00:15 CET)."
        >
          <TimeZoneSelect
            value={settings.defaultWindowTimeZone}
            onChange={(tz) => update({ defaultWindowTimeZone: tz }, `Default window zone → ${tz}`)}
          />
        </Field>
        <Field label="Default window duration (hours)" htmlFor="dur">
          <Input
            id="dur"
            type="number"
            min={0.5}
            step={0.5}
            value={settings.defaultWindowDurationHours}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > 0)
                update({ defaultWindowDurationHours: v }, `Default window duration → ${v} h`)
            }}
            className="max-w-32"
          />
        </Field>
        <Field label="Week starts on Monday">
          <div className="flex h-9 items-center gap-3">
            <Switch
              checked={settings.weekStartsMonday}
              onCheckedChange={(v) =>
                update({ weekStartsMonday: v }, `Week starts ${v ? 'Monday' : 'Sunday'}`)
              }
              label="Week starts on Monday"
            />
            <span className="text-sm text-muted">
              {settings.weekStartsMonday ? 'Monday' : 'Sunday'}
            </span>
          </div>
        </Field>
      </div>
    </Section>
  )
}

function AppearanceSection() {
  const settings = useTracker((s) => s.doc.settings)
  const update = useTracker((s) => s.updateSettings)
  return (
    <Section id="appearance" title="Appearance" icon={<Palette className="h-4 w-4" />}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Theme">
          <Segmented<ThemePref>
            ariaLabel="Theme"
            value={settings.theme}
            onChange={(theme) => update({ theme }, `Theme → ${theme}`, { history: false })}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Field>
        <Field
          label="Animations"
          hint="Off = simple fades only. System follows your Windows setting."
        >
          <Segmented<MotionPref>
            ariaLabel="Animations"
            value={settings.reducedMotion}
            onChange={(reducedMotion) =>
              update({ reducedMotion }, `Animations → ${reducedMotion}`, { history: false })
            }
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'Full' },
              { value: 'off', label: 'Reduced' },
            ]}
          />
        </Field>
      </div>
    </Section>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-8 p-8">
      <nav
        className="sticky top-0 hidden w-48 shrink-0 self-start pt-16 lg:block"
        aria-label="Settings sections"
      >
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(`settings-${s.id}`)
                    ?.scrollIntoView?.({ behavior: 'smooth' })
                }
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text cursor-pointer"
              >
                <s.icon className="h-4 w-4" /> {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <SectionTitle eyebrow="Preferences" title="Settings" />
        <DataSection
          wrap={(children) => (
            <Section
              id="data"
              title="Data & sync"
              icon={<Cloud className="h-4 w-4" />}
              description="Where your data lives. These settings stay in this browser and are never written to the data file."
            >
              {children}
            </Section>
          )}
        />
        <BackupSection />
        <TimeSection />
        <AppearanceSection />
        <Section
          id="people"
          title="Owners & assignees"
          icon={<Users className="h-4 w-4" />}
          description="Pick lists for tasks and template steps."
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PeopleListEditor kind="owners" label="Owners" />
            <PeopleListEditor kind="assignees" label="Assignees" />
          </div>
        </Section>
        <Section
          id="statuses"
          title="Statuses"
          icon={<Tags className="h-4 w-4" />}
          description="Rename, recolour, reorder, add or delete. Each status maps to a category that drives progress, overdue and N/A logic."
        >
          <div className="flex flex-col gap-8">
            <StatusListEditor
              list="scheduleStatuses"
              title="Upgrade schedule status"
              description="The legend of the global grid (Requested, Confirmed…)."
            />
            <StatusListEditor
              list="windowStatuses"
              title="Window status"
              description="For each DEV / UAT / PROD window. A missing UAT window shows as N/A."
            />
            <StatusListEditor
              list="taskStatuses"
              title="Task status"
              description="For every step of an upgrade plan."
            />
          </div>
        </Section>
      </div>
    </div>
  )
}
