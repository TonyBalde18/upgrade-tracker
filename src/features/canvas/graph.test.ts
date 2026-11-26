import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { buildGraph, BASE_LANE_H, type LaneNode } from './graph'

const now = new Date('2026-11-04T10:00:00Z')
const doc = buildDemoDoc(now)
const base = {
  customers: doc.customers,
  settings: doc.settings,
  expanded: new Set<string>(),
}

describe('canvas graph', () => {
  it('one lane and six chained phases per upgrade', () => {
    const { nodes, edges } = buildGraph({ ...base, upgrades: doc.upgrades })
    expect(nodes.filter((n) => n.type === 'lane')).toHaveLength(5)
    expect(nodes.filter((n) => n.type === 'phase')).toHaveLength(30)
    expect(edges).toHaveLength(30) // 5 per lane between phases + 1 from the lane header
  })

  it('marks the edge into the current phase as the active red flow', () => {
    const globex = doc.upgrades[1]!
    const { edges } = buildGraph({ ...base, upgrades: [globex] })
    // Globex: Preparation is current, so the flow from the lane header is the active one
    expect(edges.filter((e) => e.data?.state === 'active').map((e) => e.target)).toEqual([
      `${globex.id}:Preparation`,
    ])
    const acme = doc.upgrades[0]!
    const g = buildGraph({ ...base, upgrades: [acme] })
    expect(g.edges.find((e) => e.data?.state === 'active')?.target).toBe(`${acme.id}:UAT`)
  })

  it('uses saved positions', () => {
    const u = {
      ...doc.upgrades[0]!,
      canvas: { nodePositions: { lane: { x: 500, y: 900 }, DEV: { x: 10, y: 99 } } },
    }
    const free = buildGraph({ ...base, upgrades: [u] })
    expect(free.nodes.find((n) => n.id === `lane:${u.id}`)!.position).toEqual({ x: 500, y: 900 })
    expect(free.nodes.find((n) => n.id === `${u.id}:DEV`)!.position).toEqual({ x: 10, y: 99 })
  })

  it('makes room for an expanded phase', () => {
    const acme = doc.upgrades[0]!
    const g = buildGraph({
      ...base,
      upgrades: [acme],
      expanded: new Set([`${acme.id}:Preparation`]),
    })
    const lane = g.nodes.find((n): n is LaneNode => n.type === 'lane')!
    expect(lane.data.height).toBeGreaterThan(BASE_LANE_H)
  })
})
