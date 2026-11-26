import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { customerDefaults, emptyDoc } from '@/lib/model/defaults'
import { MigrationError, migrate, parseDocText } from '.'

describe('schema migration', () => {
  it('accepts a current document unchanged', () => {
    const doc = buildDemoDoc(new Date('2026-11-04T10:00:00Z'))
    expect(migrate(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
  })

  it('fills missing sections of a hand-edited file', () => {
    const doc = migrate({ schemaVersion: 1, customers: [] })
    expect(doc.template.steps).toHaveLength(24)
    expect(doc.settings.displayTimeZone).toBe('Europe/Lisbon')
    expect(doc.upgrades).toEqual([])
  })

  it('treats a missing schemaVersion as version 1 and upgrades it', () => {
    expect(migrate({ customers: [] }).schemaVersion).toBe(2)
  })

  it('refuses data from a newer app version', () => {
    expect(() => migrate({ ...emptyDoc(), schemaVersion: 99 })).toThrow(/newer version/)
  })

  it('reports where invalid data is', () => {
    const bad = { ...emptyDoc(), customers: [{ id: 'x' }] }
    expect(() => migrate(bad)).toThrow(MigrationError)
    expect(() => migrate(bad)).toThrow(/customers\.0/)
  })

  it('rejects non-JSON and non-objects', () => {
    expect(() => parseDocText('not json')).toThrow(/not valid JSON/)
    expect(() => parseDocText('[1,2]')).toThrow(/expected a JSON object/)
  })

  it('round-trips accented names', () => {
    const doc = emptyDoc()
    doc.customers.push({
      id: 'c1',
      name: 'Société Générale Zürich',
      shortName: 'SGZ',
      color: '#E1292C',
      ...customerDefaults(),
      snContact: 'José Ñúñez',
    })
    expect(parseDocText(JSON.stringify(doc)).customers[0]!.name).toBe('Société Générale Zürich')
  })

  it('accepts a raster logo and rejects SVG or script URLs', () => {
    const doc = emptyDoc()
    const customer = {
      id: 'c1',
      name: 'Logo Co',
      shortName: 'LC',
      color: '#E1292C',
      snContact: '',
      consultants: [],
      instances: { dev: '', uat: '', prod: '' },
      notes: '',
      active: true,
    }
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    expect(migrate({ ...doc, customers: [{ ...customer, logo: png }] }).customers[0]!.logo).toBe(
      png,
    )
    expect(migrate({ ...doc, customers: [customer] }).customers[0]!.logo).toBeUndefined()
    expect(() =>
      migrate({ ...doc, customers: [{ ...customer, logo: 'data:image/svg+xml;base64,PHN2Zz4=' }] }),
    ).toThrow(/logo/)
    expect(() =>
      migrate({ ...doc, customers: [{ ...customer, logo: 'javascript:alert(1)' }] }),
    ).toThrow(/logo/)
  })
})

describe('version 1 to 2', () => {
  /** A version 1 document as the previous app stored it. */
  function v1Doc() {
    const doc = JSON.parse(JSON.stringify(buildDemoDoc(new Date('2026-11-04T10:00:00Z'))))
    doc.schemaVersion = 1
    delete doc.settings.people
    doc.settings.scheduleStatuses = [
      { id: 'ss-requested', label: 'Requested', tone: 'amber', category: 'planned' },
      { id: 'ss-confirmed', label: 'Confirmed', tone: 'sky', category: 'confirmed' },
      {
        id: 'ss-customer-start',
        label: 'Customer confirmed start',
        tone: 'teal',
        category: 'confirmed',
      },
      { id: 'ss-in-progress', label: 'In progress', tone: 'violet', category: 'active' },
      { id: 'ss-done', label: 'Done', tone: 'green', category: 'done' },
      { id: 'ss-cancelled', label: 'Cancelled', tone: 'slate', category: 'cancelled' },
    ]
    for (const c of doc.customers)
      for (const k of [
        'envNames',
        'currentRelease',
        'currentPatch',
        'releaseCheckedAt',
        'documents',
      ])
        delete c[k]
    for (const u of doc.upgrades) {
      for (const k of ['extraWindows', 'documents', 'lessonsLearned']) delete u[k]
      for (const env of ['dev', 'uat', 'prod']) if (u.windows[env]) delete u.windows[env].goNoGo
      for (const t of u.tasks) {
        delete t.assignedTo
        if (/freeze/i.test(t.name)) t.kind = 'milestone'
      }
    }
    for (const s of doc.template.steps) {
      s.name = s.name.replace('{test}', 'UAT')
      if (/freeze/i.test(s.name)) s.kind = 'milestone'
    }
    return doc
  }

  it('fills the new fields with safe defaults', () => {
    const doc = migrate(v1Doc())
    expect(doc.schemaVersion).toBe(2)
    expect(doc.settings.people).toEqual([])
    expect(doc.customers[0]!.envNames).toEqual({ dev: 'DEV', uat: 'UAT', prod: 'PROD' })
    expect(doc.customers[0]!.documents).toEqual([])
    const u = doc.upgrades[0]!
    expect(u.extraWindows).toEqual([])
    expect(u.lessonsLearned).toBe('')
    expect(u.tasks.every((t) => t.assignedTo === '')).toBe(true)
  })

  it('turns the statuses into the approval flow', () => {
    const raw = v1Doc()
    raw.upgrades[0].scheduleStatus = 'ss-customer-start'
    const doc = migrate(raw)
    expect(doc.settings.scheduleStatuses.map((s) => s.label)).toEqual([
      'Proposed',
      'Pending approval',
      'Approved',
      'In progress',
      'Done',
      'Cancelled',
    ])
    expect(doc.upgrades[0]!.scheduleStatus).toBe('ss-confirmed')
  })

  it('keeps status names the user changed', () => {
    const raw = v1Doc()
    raw.settings.scheduleStatuses[0].label = 'Asked customer'
    expect(migrate(raw).settings.scheduleStatuses[1]!.label).toBe('Asked customer')
  })

  it('makes freeze steps multi-day and names the test environment {test} in the template', () => {
    const doc = migrate(v1Doc())
    const freeze = doc.template.steps.find((s) => /freeze/i.test(s.name))!
    expect(freeze.kind).toBe('task')
    expect(doc.template.steps.some((s) => s.name === 'Upgrade {test} to {family} release')).toBe(
      true,
    )
    expect(doc.template.steps.some((s) => s.name === 'User acceptance testing')).toBe(true)
    expect(doc.upgrades[0]!.tasks.find((t) => /freeze/i.test(t.name))!.kind).toBe('task')
  })

  it('records Go on windows that are already done and sets the current release', () => {
    const raw = v1Doc()
    raw.upgrades[0].scheduleStatus = 'ss-done'
    const doc = migrate(raw)
    const done = doc.upgrades.flatMap((u) => [u.windows.dev]).find((w) => w.status === 'ws-done')
    expect(done?.goNoGo.decision).toBe('go')
    const planned = doc.upgrades[0]!.windows.prod
    if (planned.status !== 'ws-done') expect(planned.goNoGo.decision).toBe('pending')
    expect(doc.customers.find((c) => c.id === doc.upgrades[0]!.customerId)!.currentRelease).toBe(
      'Australia',
    )
  })

  it('migrating twice changes nothing more', () => {
    const once = migrate(v1Doc())
    expect(migrate(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })

  it('reads a part written by an older app without the new fields', () => {
    const doc = JSON.parse(JSON.stringify(buildDemoDoc(new Date('2026-11-04T10:00:00Z'))))
    delete doc.customers[0].envNames
    delete doc.upgrades[0].extraWindows
    delete doc.upgrades[0].windows.dev.goNoGo
    const out = migrate(doc)
    expect(out.customers[0]!.envNames.uat).toBe('UAT')
    expect(out.upgrades[0]!.windows.dev.goNoGo.decision).toBe('pending')
  })
})
