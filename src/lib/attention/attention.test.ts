import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { attentionItems, upgradesPerMonth } from '.'

const now = new Date('2026-11-04T10:00:00Z')
const today = '2026-11-04'

describe('needs attention', () => {
  it('lists high items first', () => {
    const items = attentionItems(buildDemoDoc(now), today)
    expect(items.length).toBeGreaterThan(0)
    const ranks = items.map((i) => ({ high: 0, medium: 1, low: 2 })[i.level])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('reports the demo clash, blocked steps and missing case links', () => {
    const items = attentionItems(buildDemoDoc(now), today)
    expect(items.some((i) => i.key.startsWith('clash:'))).toBe(true)
    expect(items.some((i) => i.key.startsWith('blocked:'))).toBe(true)
    expect(items.some((i) => i.key.startsWith('case:'))).toBe(true)
  })

  it('asks for a Go / No-Go shortly before a window and stops once decided', () => {
    const doc = buildDemoDoc(now)
    const u = doc.upgrades.find((x) => x.windows.prod.start.slice(0, 10) >= today)!
    u.windows.prod = { ...u.windows.prod, start: '2026-11-06T00:15', status: 'ws-planned' }
    const key = `gonogo:${u.id}:prod`
    expect(attentionItems(doc, today).some((i) => i.key === key)).toBe(true)
    u.windows.prod.goNoGo = { decision: 'go', date: today, by: 'SDM' }
    expect(attentionItems(doc, today).some((i) => i.key === key)).toBe(false)
  })

  it('asks to check the release of customers not checked for 3 months', () => {
    const doc = buildDemoDoc(now)
    const id = doc.upgrades.find((u) => u.scheduleStatus !== 'ss-done')!.customerId
    expect(attentionItems(doc, today).some((i) => i.key === `release:${id}`)).toBe(true)
    doc.customers.find((c) => c.id === id)!.releaseCheckedAt = '2026-10-01'
    expect(attentionItems(doc, today).some((i) => i.key === `release:${id}`)).toBe(false)
  })
})

describe('upgrades per month', () => {
  it('covers 12 months and counts each upgrade once by its PROD month', () => {
    const doc = buildDemoDoc(now)
    const bars = upgradesPerMonth(doc, today)
    expect(bars).toHaveLength(12)
    expect(bars[0]!.month).toBe('2026-09')
    expect(bars[11]!.month).toBe('2027-08')
    const inRange = doc.upgrades.filter(
      (u) =>
        u.windows.prod.start.slice(0, 7) >= '2026-09' &&
        u.windows.prod.start.slice(0, 7) <= '2027-08',
    )
    expect(bars.reduce((s, b) => s + b.total, 0)).toBe(inRange.length)
  })
})
