import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { defaultSettings } from '@/lib/model/defaults'
import type { Upgrade } from '@/lib/model/types'
import { makeWindow } from '@/lib/upgrade/logic'
import { dependentTaskIds, nightOf, phaseSpans, prodClashes, windowPosition } from '.'

const now = new Date('2026-11-04T10:00:00Z')
const settings = defaultSettings()

function withProd(u: Upgrade, customerId: string, start: string, tz = 'Europe/Zurich'): Upgrade {
  return {
    ...u,
    id: `${customerId}-u`,
    customerId,
    windows: {
      ...u.windows,
      prod: makeWindow(start.slice(0, 10), start.slice(11), tz, 3, 'ws-planned', now),
    },
  }
}

describe('nights', () => {
  it('puts late-evening and early-morning windows on the same night', () => {
    expect(nightOf('2026-11-23T22:00')).toBe('2026-11-23')
    expect(nightOf('2026-11-24T00:15')).toBe('2026-11-23')
    expect(nightOf('2026-11-24T13:00')).toBe('2026-11-24')
  })
})

describe('window position', () => {
  it('converts to the display zone', () => {
    const w = makeWindow('2026-11-24', '00:15', 'Europe/Zurich', 3, 'ws-planned', now)
    const p = windowPosition(w, 'Europe/Lisbon')
    expect(p.local).toBe('2026-11-23T23:15')
    expect(p.date).toBe('2026-11-23')
    expect(p.fraction).toBeCloseTo((23 * 60 + 15) / 1440)
  })
})

describe('PROD clashes', () => {
  const base = buildDemoDoc(now).upgrades[0]!

  it('flags two customers on the same night, even across midnight and zones', () => {
    const ups = [
      withProd(base, 'a', '2026-12-01T00:15'),
      withProd(base, 'b', '2026-11-30T22:00', 'Europe/London'),
    ]
    const { nights, weeks } = prodClashes(ups, settings)
    expect(nights).toHaveLength(1)
    expect(nights[0]!.entries.map((e) => e.customerId)).toEqual(['b', 'a'])
    expect(weeks).toHaveLength(1)
  })

  it('flags the same ISO week but not the same night', () => {
    const ups = [withProd(base, 'a', '2026-11-24T00:15'), withProd(base, 'b', '2026-11-27T00:15')]
    const r = prodClashes(ups, settings)
    expect(r.nights).toHaveLength(0)
    expect(r.weeks).toHaveLength(1)
    expect(r.weeks[0]!.key).toBe('2026-11-23')
  })

  it('ignores one customer twice and cancelled upgrades', () => {
    const same = [
      withProd(base, 'a', '2026-12-01T00:15'),
      { ...withProd(base, 'a', '2026-12-01T01:00'), id: 'a2' },
    ]
    expect(prodClashes(same, settings).nights).toHaveLength(0)
    const cancelled = [
      withProd(base, 'a', '2026-12-01T00:15'),
      { ...withProd(base, 'b', '2026-12-01T00:15'), scheduleStatus: 'ss-cancelled' },
    ]
    expect(prodClashes(cancelled, settings).nights).toHaveLength(0)
  })

  it('finds the demo clash (Globex and Contoso go live the same night)', () => {
    const doc = buildDemoDoc(now)
    const { nights } = prodClashes(doc.upgrades, doc.settings)
    expect(nights.flatMap((n) => n.entries.map((e) => e.customerId)).sort()).toEqual([
      'demo-contoso',
      'demo-globex',
    ])
  })
})

describe('phase spans', () => {
  it('spans each phase and summarises its state', () => {
    const doc = buildDemoDoc(now)
    const acme = doc.upgrades[0]!
    const spans = phaseSpans(acme, doc.settings)
    expect(spans.map((s) => s.phase)).toEqual([
      'Preparation',
      'DEV',
      'UAT',
      'Go-live',
      'PROD',
      'Hypercare',
    ])
    expect(spans.find((s) => s.phase === 'Preparation')!.state).toBe('done')
    expect(spans.find((s) => s.phase === 'UAT')!.state).toBe('blocked') // demo has a blocked UAT step
    expect(spans.find((s) => s.phase === 'Hypercare')!.state).toBe('planned')
  })

  it('skips N/A phases', () => {
    const doc = buildDemoDoc(now)
    const globex = doc.upgrades[1]! // no UAT
    expect(phaseSpans(globex, doc.settings).some((s) => s.phase === 'UAT')).toBe(false)
  })
})

describe('dependent tasks', () => {
  it('lists the tasks anchored on a window', () => {
    const doc = buildDemoDoc(now)
    const anchors = new Map(doc.template.steps.map((s) => [s.id, s.anchor]))
    expect(dependentTaskIds(doc.upgrades[0]!, anchors, 'prod')).toHaveLength(9)
    expect(dependentTaskIds(doc.upgrades[1]!, anchors, 'uat')).toHaveLength(0)
  })
})
