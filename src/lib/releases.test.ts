import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { migrate } from '@/lib/migrations'
import { knownReleases, releaseLogoOf, withReleaseLogo } from './releases'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('release logos', () => {
  it('finds a logo case-insensitively', () => {
    const settings = { releaseLogos: { Brazil: PNG } }
    expect(releaseLogoOf(settings, 'Brazil')).toBe(PNG)
    expect(releaseLogoOf(settings, ' brazil ')).toBe(PNG)
    expect(releaseLogoOf(settings, 'Zurich')).toBeUndefined()
    expect(releaseLogoOf({}, 'Brazil')).toBeUndefined()
  })

  it('sets, replaces and removes a logo without duplicates', () => {
    let logos = withReleaseLogo(undefined, 'Brazil', PNG)
    expect(logos).toEqual({ Brazil: PNG })
    logos = withReleaseLogo(logos, 'brazil', PNG + 'A')
    expect(logos).toEqual({ brazil: PNG + 'A' })
    expect(withReleaseLogo(logos, 'BRAZIL', undefined)).toEqual({})
  })

  it('lists known, used and logo-only releases once each', () => {
    const doc = buildDemoDoc()
    doc.upgrades[0]!.family = 'Custom release'
    doc.settings.releaseLogos = { 'Logo only': PNG, australia: PNG }
    const list = knownReleases(doc)
    expect(list.slice(0, 6)).toEqual([
      'Washington DC',
      'Xanadu',
      'Yokohama',
      'Zurich',
      'Australia',
      'Brazil',
    ])
    expect(list).toContain('Custom release')
    expect(list).toContain('Logo only')
    expect(list.filter((n) => n.toLowerCase() === 'australia')).toHaveLength(1)
  })

  it('survives validation (import / database load) and rejects SVG', () => {
    const doc = buildDemoDoc()
    doc.settings.releaseLogos = { Brazil: PNG }
    expect(migrate(JSON.parse(JSON.stringify(doc))).settings.releaseLogos).toEqual({ Brazil: PNG })
    doc.settings.releaseLogos = { Brazil: 'data:image/svg+xml;base64,PHN2Zz4=' }
    expect(() => migrate(JSON.parse(JSON.stringify(doc)))).toThrow()
  })
})
