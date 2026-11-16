import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { addDaysIso } from '@/lib/dates'
import {
  activityHeat,
  agenda,
  blockedTasks,
  groupByDay,
  nextTasks,
  nextWindow,
  overdueTasks,
  upcomingGoNoGo,
} from '.'

const now = new Date('2026-11-04T10:00:00Z')
const today = '2026-11-04'
const doc = buildDemoDoc(now)

describe('overdue and blocked', () => {
  it('in fresh demo data only the blocked UAT fix task is overdue', () => {
    const od = overdueTasks(doc, today)
    expect(od.map((o) => o.task.templateStepId)).toEqual(['step-15'])
  })

  it('reports an open task that ended before today, with days late', () => {
    const d = structuredClone(doc)
    const t = d.upgrades[0]!.tasks.find((x) => x.templateStepId === 'step-01')!
    t.status = 'ts-in-progress'
    const od = overdueTasks(d, today)
    expect(od).toHaveLength(2)
    expect(od[0]!.task.templateStepId).toBe('step-01') // most late first
    expect(od[0]!.daysLate).toBeGreaterThan(od[1]!.daysLate)
  })

  it('ignores done upgrades and lists blocked tasks', () => {
    expect(blockedTasks(doc).map((b) => b.task.templateStepId)).toEqual(['step-15'])
  })
})

describe('agenda', () => {
  const items = agenda(doc, today, addDaysIso(today, 6))

  it('includes windows with converted local time', () => {
    const w = items.filter((i) => i.kind === 'window')
    // Acme PROD (+4), Contoso DEV (+4), Globex DEV (+6)
    expect(w.map((i) => `${i.upgrade.customerId}:${i.env}`).sort()).toEqual([
      'demo-acme:prod',
      'demo-contoso:dev',
      'demo-globex:dev',
    ])
    // 00:15 Zurich = 23:15 Lisbon, the day before
    const acme = w.find((i) => i.upgrade.customerId === 'demo-acme')!
    expect(acme.time).toBe('23:15')
    expect(acme.date).toBe(addDaysIso(today, 3))
  })

  it('shows calls as calls and multi-day tasks as start + due', () => {
    expect(items.some((i) => i.kind === 'call' && /Go \/ No-Go/.test(i.task!.name))).toBe(true)
    const kinds = new Set(items.map((i) => i.kind))
    expect(kinds.has('start') || kinds.has('due')).toBe(true)
  })

  it('is sorted by day then time, and groups by day', () => {
    const dates = items.map((i) => i.date)
    expect([...dates].sort()).toEqual(dates)
    const groups = groupByDay(items)
    expect(new Set(groups.map((g) => g.date)).size).toBe(groups.length)
  })

  it('skips N/A tasks (Globex has no UAT)', () => {
    const all = agenda(doc, today, addDaysIso(today, 60))
    expect(all.some((i) => i.upgrade.customerId === 'demo-globex' && i.task?.phase === 'UAT')).toBe(
      false,
    )
  })
})

describe('next window and calls', () => {
  it('finds the next window (Acme PROD in ~4 days or Contoso DEV)', () => {
    const n = nextWindow(doc, now)!
    expect(['demo-acme', 'demo-contoso']).toContain(n.upgrade.customerId)
    expect(n.start.getTime()).toBeGreaterThan(now.getTime())
  })

  it('lists upcoming Go / No-Go calls in date order', () => {
    const calls = upcomingGoNoGo(doc, today, 30)
    expect(calls.length).toBeGreaterThan(0)
    const starts = calls.map((c) => c.task.start!)
    expect([...starts].sort()).toEqual(starts)
  })
})

describe('heat strip', () => {
  it('has one cell per day with levels between 0 and 1 and windows on their day', () => {
    const heat = activityHeat(doc, today, 30)
    expect(heat).toHaveLength(30)
    expect(heat.every((h) => h.level >= 0 && h.level <= 1)).toBe(true)
    expect(Math.max(...heat.map((h) => h.level))).toBe(1)
    expect(heat.flatMap((h) => h.windows).length).toBeGreaterThan(3)
  })

  it('lists the next open tasks of an upgrade', () => {
    const next = nextTasks(doc.upgrades[1]!, doc.settings, 3)
    expect(next).toHaveLength(3)
    expect(next[0]!.start! <= next[1]!.start!).toBe(true)
  })
})
