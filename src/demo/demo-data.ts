/**
 * Fictional demo data. These companies do not exist. Real customer names must
 * never be added to the code: they only live in the private tracker.json.
 * Dates are relative to "today" so the demo always looks current.
 */
import { addDaysIso, todayIn } from '@/lib/dates'
import { emptyDoc } from '@/lib/model/defaults'
import type { Customer, Task, TrackerDoc, Upgrade, UpgradeWindow } from '@/lib/model/types'
import { generateTasks, statusCategory } from '@/lib/template/schedule'

interface DemoCustomer {
  key: string
  name: string
  shortName: string
  color: string
  contact: string
  consultants: string[]
}

const CUSTOMERS: DemoCustomer[] = [
  {
    key: 'acme',
    name: 'Acme Corp',
    shortName: 'ACME',
    color: '#E1292C',
    contact: 'Jane Doe',
    consultants: ['Alex Demo'],
  },
  {
    key: 'globex',
    name: 'Globex',
    shortName: 'GLX',
    color: '#0EA5E9',
    contact: 'John Roe',
    consultants: ['Alex Demo', 'Sam Sample'],
  },
  {
    key: 'initech',
    name: 'Initech',
    shortName: 'INI',
    color: '#8B5CF6',
    contact: 'Max Mustermann',
    consultants: ['Sam Sample'],
  },
  {
    key: 'northwind',
    name: 'Northwind Traders',
    shortName: 'NWT',
    color: '#10B981',
    contact: 'Erika Mustermann',
    consultants: ['Alex Demo'],
  },
  {
    key: 'contoso',
    name: 'Contoso Health',
    shortName: 'CTH',
    color: '#F59E0B',
    contact: 'Juan Pérez',
    consultants: ['Sam Sample'],
  },
  {
    key: 'fabrikam',
    name: 'Fabrikam',
    shortName: 'FAB',
    color: '#EC4899',
    contact: 'Ola Nordmann',
    consultants: [],
  },
]

interface DemoUpgrade {
  customer: string
  dev: number
  uat: number | null
  prod: number
  time: string
  tz: string
  status: string
  blockedStep?: string
}

const UPGRADES: DemoUpgrade[] = [
  {
    customer: 'acme',
    dev: -20,
    uat: -10,
    prod: 4,
    time: '00:15',
    tz: 'Europe/Zurich',
    status: 'ss-in-progress',
    blockedStep: 'step-15',
  },
  {
    customer: 'globex',
    dev: 6,
    uat: null,
    prod: 20,
    time: '00:15',
    tz: 'Europe/Zurich',
    status: 'ss-confirmed',
  },
  {
    customer: 'initech',
    dev: 12,
    uat: 19,
    prod: 33,
    time: '22:00',
    tz: 'Europe/London',
    status: 'ss-requested',
  },
  {
    customer: 'northwind',
    dev: -45,
    uat: -35,
    prod: -21,
    time: '00:15',
    tz: 'Europe/Zurich',
    status: 'ss-done',
  },
  {
    customer: 'contoso',
    dev: 4,
    uat: 11,
    prod: 20,
    time: '01:00',
    tz: 'Europe/Zurich',
    status: 'ss-customer-start',
  },
]

export function buildDemoDoc(now: Date = new Date()): TrackerDoc {
  const doc = emptyDoc(now)
  const today = todayIn(doc.settings.displayTimeZone, now)
  const stamp = now.toISOString()
  const ids = new Map<string, string>()

  doc.customers = CUSTOMERS.map((c): Customer => {
    const id = `demo-${c.key}`
    ids.set(c.key, id)
    const host = c.key
    return {
      id,
      name: c.name,
      shortName: c.shortName,
      color: c.color,
      snContact: c.contact,
      consultants: c.consultants,
      instances: {
        dev: `https://${host}dev.service-now.com`,
        uat: `https://${host}uat.service-now.com`,
        prod: `https://${host}.service-now.com`,
      },
      notes: 'Fictional demo customer.',
      active: c.key !== 'fabrikam',
    }
  })

  const windowAt = (offset: number, time: string, tz: string): UpgradeWindow => {
    const date = addDaysIso(today, offset)
    const status = offset < 0 ? 'ws-done' : offset < 8 ? 'ws-confirmed' : 'ws-planned'
    return { start: `${date}T${time}`, timeZone: tz, durationHours: 3, status, updatedAt: stamp }
  }

  doc.upgrades = UPGRADES.map((u, i): Upgrade => {
    const windows = {
      dev: windowAt(u.dev, u.time, u.tz),
      uat: u.uat == null ? null : windowAt(u.uat, u.time, u.tz),
      prod: windowAt(u.prod, u.time, u.tz),
    }
    const tasks: Task[] = generateTasks({
      template: doc.template,
      windows,
      family: 'Australia',
      settings: doc.settings,
      now,
    }).map((t) => {
      if (statusCategory(doc.settings.taskStatuses, t.status) === 'na' || !t.start || !t.end)
        return t
      let status = t.status
      if (u.status === 'ss-done' || t.end < today) status = 'ts-completed'
      else if (t.start <= today) status = 'ts-in-progress'
      if (t.templateStepId === u.blockedStep) status = 'ts-blocked'
      return { ...t, status, id: `demo-${u.customer}-${t.templateStepId}` }
    })
    return {
      id: `demo-upg-${i + 1}`,
      customerId: ids.get(u.customer) ?? '',
      family: 'Australia',
      fromFamily: 'Zurich',
      cycle: '2026-H2',
      scheduleStatus: u.status,
      snCaseUrl: '',
      notes: '',
      windows,
      tasks,
      canvas: {},
      log: [{ at: stamp, text: 'Demo upgrade created', kind: 'auto' }],
      createdAt: stamp,
      updatedAt: stamp,
    }
  })
  return doc
}
