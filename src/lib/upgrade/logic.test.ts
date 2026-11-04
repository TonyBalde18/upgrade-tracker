import { describe, expect, it } from 'vitest'
import { defaultSettings, defaultTemplate } from '@/lib/model/defaults'
import { buildDemoDoc } from '@/demo/demo-data'
import {
  activeUpgradeFor,
  applyTemplate,
  buildUpgrade,
  cycleForDate,
  defaultWindows,
  duplicateForNextCycle,
  makeWindow,
  moveTask,
  nextCycle,
  nextTuesday,
  setUatWindow,
  shiftUpgrade,
  windowOfTask,
  windowTaskId,
  windowWarnings,
} from './logic'

const settings = defaultSettings()
const template = defaultTemplate()
const now = new Date('2026-11-04T10:00:00Z')
const w = (d: string) => makeWindow(d, '00:15', 'Europe/Zurich', 3, 'ws-planned', now)
const windows = { dev: w('2026-11-24'), uat: w('2026-12-01'), prod: w('2026-12-15') }
const make = () =>
  buildUpgrade(
    {
      customerId: 'c1',
      family: 'Australia',
      fromFamily: 'Zurich',
      cycle: '2026-H2',
      snCaseUrl: '',
      windows,
    },
    template,
    settings,
    now,
  )

describe('cycles', () => {
  it('rolls over half-years', () => {
    expect(nextCycle('2026-H1')).toBe('2026-H2')
    expect(nextCycle('2026-H2')).toBe('2027-H1')
    expect(nextCycle('Q3 2026')).toBe('Q3 2026')
    expect(cycleForDate('2026-11-24')).toBe('2026-H2')
    expect(cycleForDate('2027-03-02')).toBe('2027-H1')
  })
})

describe('windows', () => {
  it('defaults to a Tuesday about three weeks out, then +7 and +21', () => {
    expect(nextTuesday('2026-11-04')).toBe('2026-11-10')
    expect(nextTuesday('2026-11-10')).toBe('2026-11-10')
    const d = defaultWindows('2026-11-04', settings, now)
    // 4 Nov + 21 days = Wed 25 Nov -> next Tuesday 1 Dec
    expect(d.dev.start).toBe('2026-12-01T00:15')
    expect(d.uat?.start).toBe('2026-12-08T00:15')
    expect(d.prod.start).toBe('2026-12-22T00:15')
    expect(d.dev.timeZone).toBe('Europe/Zurich')
  })

  it('warns when windows are out of order', () => {
    expect(windowWarnings(windows)).toEqual([])
    expect(windowWarnings({ ...windows, prod: w('2026-11-20') })).toEqual([
      'PROD is before DEV.',
      'PROD is before UAT.',
    ])
  })
})

describe('one active upgrade per customer', () => {
  it('finds the active upgrade and ignores done/cancelled ones', () => {
    const doc = buildDemoDoc(now)
    expect(activeUpgradeFor('demo-acme', doc)?.id).toBe('demo-upg-1')
    expect(activeUpgradeFor('demo-northwind', doc)).toBeUndefined() // Done
    expect(activeUpgradeFor('demo-fabrikam', doc)).toBeUndefined() // none
    expect(activeUpgradeFor('demo-acme', doc, 'demo-upg-1')).toBeUndefined()
  })
})

describe('shift and duplicate', () => {
  it('shifts windows and tasks, keeping N/A dates empty', () => {
    const u = make()
    const noUat = setUatWindow(u, null, template, settings, now)
    const s = shiftUpgrade(noUat, 7, true, now)
    expect(s.windows.dev.start).toBe('2026-12-01T00:15')
    expect(s.windows.uat).toBeNull()
    const prodTask = s.tasks.find((t) => t.templateStepId === 'step-21')!
    expect(prodTask.start).toBe('2026-12-22')
    expect(s.tasks.find((t) => t.templateStepId === 'step-12')!.start).toBeNull()
  })

  it('duplicates for the next cycle with a fresh plan', () => {
    const u = make()
    u.tasks[0]!.status = 'ts-completed'
    const copy = duplicateForNextCycle(
      u,
      { family: 'Brazil', cycle: '2027-H1', shiftDays: 182 },
      template,
      settings,
      now,
    )
    expect(copy.id).not.toBe(u.id)
    expect(copy.fromFamily).toBe('Australia')
    expect(copy.family).toBe('Brazil')
    expect(copy.windows.dev.start).toBe('2027-05-25T00:15')
    expect(copy.tasks.every((t) => t.status === 'ts-not-started')).toBe(true)
    expect(copy.tasks.find((t) => t.templateStepId === 'step-09')!.name).toBe(
      'Upgrade DEV to Brazil release',
    )
  })
})

describe('UAT on/off', () => {
  it('marks UAT steps N/A and brings them back', () => {
    const u = make()
    const off = setUatWindow(u, null, template, settings, now)
    const uatTasks = off.tasks.filter((t) => t.phase === 'UAT')
    expect(uatTasks.every((t) => t.status === 'ts-na' && t.start === null)).toBe(true)
    const on = setUatWindow(off, w('2026-12-03'), template, settings, now)
    const upg = on.tasks.find((t) => t.templateStepId === 'step-12')!
    expect(upg.status).toBe('ts-not-started')
    expect(upg.start).toBe('2026-12-03')
  })
})

describe('linking windows and "Upgrade …" tasks', () => {
  it('finds the task for each window and back', () => {
    const u = make()
    const prodId = windowTaskId(u, template, 'prod')!
    expect(u.tasks.find((t) => t.id === prodId)!.name).toBe('Upgrade Prod to Australia release')
    expect(windowOfTask(u, template, prodId)).toBe('prod')
    expect(windowOfTask(u, template, u.tasks[0]!.id)).toBeUndefined()
  })
})

describe('reorder', () => {
  it('moves a task and adopts the phase of where it lands', () => {
    const u = make()
    const first = u.tasks[0]! // Preparation
    const devTask = u.tasks[9]! // DEV
    const moved = moveTask(u.tasks, first.id, devTask.id)
    const m = moved.find((t) => t.id === first.id)!
    expect(m.phase).toBe('DEV')
    expect(m.order).toBe(9)
    expect(moved.map((t) => t.order)).toEqual([...Array(24).keys()])
  })
})

describe('apply template', () => {
  it('keeps progress, adds new steps and keeps removed ones as custom tasks', () => {
    const u = make()
    u.tasks[0]!.status = 'ts-completed'
    u.tasks[0]!.notes = 'done early'
    const custom = {
      ...u.tasks[1]!,
      id: 'custom',
      templateStepId: null,
      name: 'Custom check',
      order: 1.5,
    }
    u.tasks.push(custom)
    const t2 = defaultTemplate()
    t2.steps = t2.steps.filter((s) => s.id !== 'step-24')
    t2.steps.push({ ...t2.steps[0]!, id: 'step-new', name: 'Brand new step' })
    const res = applyTemplate(u, t2, settings, now)
    expect(res.added).toBe(1)
    expect(res.detached).toBe(1)
    const kept = res.tasks.find((t) => t.templateStepId === 'step-01')!
    expect(kept.status).toBe('ts-completed')
    expect(kept.notes).toBe('done early')
    expect(res.tasks.find((t) => t.name === 'Documentation')!.templateStepId).toBeNull()
    // custom task stays right after the step it followed
    const idx = res.tasks.findIndex((t) => t.id === 'custom')
    expect(res.tasks[idx - 1]!.templateStepId).toBe('step-02')
    expect(res.tasks).toHaveLength(26)
  })
})
