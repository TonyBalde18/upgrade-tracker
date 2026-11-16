import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { emptyDoc } from '@/lib/model/defaults'
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

  it('treats a missing schemaVersion as version 1', () => {
    expect(migrate({ customers: [] }).schemaVersion).toBe(1)
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
      snContact: 'José Ñúñez',
      consultants: [],
      instances: { dev: '', uat: '', prod: '' },
      notes: '',
      active: true,
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
