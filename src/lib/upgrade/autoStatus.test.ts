import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import type { Upgrade } from '@/lib/model/types'
import { AUTO_DONE, AUTO_STARTED, autoStatusChanges } from './autoStatus'

const doc = buildDemoDoc()
const s = doc.settings
const base = (): Upgrade => structuredClone(doc.upgrades[0]!)

function at(u: Upgrade, env: 'dev' | 'prod', hoursAfter: number): Date {
  const w = u.windows[env]
  const [d, t] = w.start.split('T')
  // windows in the demo are in Europe/Zurich; a day of margin avoids zone maths
  return new Date(new Date(`${d}T${t}:00Z`).getTime() + hoursAfter * 3_600_000)
}

describe('automatic upgrade status', () => {
  it('moves a confirmed upgrade to In progress when DEV starts', () => {
    const u = { ...base(), scheduleStatus: 'ss-confirmed', log: [] }
    expect(autoStatusChanges([u], s, at(u, 'dev', -24))).toEqual([])
    expect(autoStatusChanges([u], s, at(u, 'dev', 24))).toEqual([
      { upgradeId: u.id, statusId: 'ss-in-progress', logText: AUTO_STARTED },
    ])
  })

  it('never repeats once it has acted (a manual change wins)', () => {
    const u = {
      ...base(),
      scheduleStatus: 'ss-confirmed',
      log: [{ at: '', text: AUTO_STARTED, kind: 'auto' as const }],
    }
    expect(autoStatusChanges([u], s, at(u, 'dev', 24))).toEqual([])
  })

  it('marks Done only after PROD and with PROD + Hypercare steps completed', () => {
    const u = { ...base(), scheduleStatus: 'ss-in-progress', log: [] }
    const after = at(u, 'prod', 48)
    expect(autoStatusChanges([u], s, after)).toEqual([]) // steps still open
    const closed = {
      ...u,
      tasks: u.tasks.map((t) =>
        t.phase === 'PROD' || t.phase === 'Hypercare' ? { ...t, status: 'ts-completed' } : t,
      ),
    }
    expect(autoStatusChanges([closed], s, at(u, 'prod', -48))).toEqual([]) // before PROD
    expect(autoStatusChanges([closed], s, after)).toEqual([
      { upgradeId: u.id, statusId: 'ss-done', logText: AUTO_DONE },
    ])
  })

  it('leaves cancelled and done upgrades alone', () => {
    for (const st of ['ss-cancelled', 'ss-done']) {
      const u = { ...base(), scheduleStatus: st, log: [] }
      expect(autoStatusChanges([u], s, at(u, 'prod', 500))).toEqual([])
    }
  })
})
