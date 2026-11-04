import { describe, expect, it } from 'vitest'
import { defaultSettings, defaultTemplate } from '@/lib/model/defaults'
import type { UpgradeWindow } from '@/lib/model/types'
import { generateTasks, progressOf, recalculateTasks } from './schedule'

const win = (start: string, tz = 'Europe/Zurich'): UpgradeWindow => ({
  start,
  timeZone: tz,
  durationHours: 3,
  status: 'ws-planned',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const settings = defaultSettings()
const template = defaultTemplate()
// DEV Tue 24 Nov 2026, UAT Tue 1 Dec, PROD Tue 15 Dec
const windows = {
  dev: win('2026-11-24T00:15'),
  uat: win('2026-12-01T00:15'),
  prod: win('2026-12-15T00:15'),
}
const byStep = (tasks: ReturnType<typeof generateTasks>, n: number) =>
  tasks.find((t) => t.templateStepId === `step-${String(n).padStart(2, '0')}`)!

describe('template scheduling', () => {
  const tasks = generateTasks({ template, windows, family: 'Australia', settings })

  it('creates one task per template step, in order', () => {
    expect(tasks).toHaveLength(24)
    expect(tasks.map((t) => t.order)).toEqual([...Array(24).keys()])
  })

  it('applies offsets from the anchor window', () => {
    expect(byStep(tasks, 1).start).toBe('2026-11-03') // DEV -21
    expect(byStep(tasks, 9).start).toBe('2026-11-24') // DEV 0
    expect(byStep(tasks, 12).start).toBe('2026-12-01') // UAT 0
    expect(byStep(tasks, 18).start).toBe('2026-12-11') // PROD -3 = Sat 12 Dec -> Fri 11 Dec
    expect(byStep(tasks, 21).start).toBe('2026-12-15') // PROD 0
  })

  it('uses durations for multi-day tasks and one day for milestones', () => {
    const smoke = byStep(tasks, 10) // DEV +1, 3 days
    expect([smoke.start, smoke.end]).toEqual(['2026-11-25', '2026-11-27'])
    const hyper = byStep(tasks, 23) // PROD +1, 10 days
    expect([hyper.start, hyper.end]).toEqual(['2026-12-16', '2026-12-25'])
    const golive = byStep(tasks, 18)
    expect(golive.start).toBe(golive.end)
  })

  it('moves weekend dates (negative offsets to Friday)', () => {
    // DEV -3 = Sat 21 Nov -> Fri 20 Nov
    expect(byStep(tasks, 4).start).toBe('2026-11-20')
  })

  it('fills in the family name and the window time', () => {
    const t = byStep(tasks, 21)
    expect(t.name).toBe('Upgrade Prod to Australia release')
    expect(t.time).toEqual({ start: '00:15', end: '03:15', timeZone: 'Europe/Zurich' })
    expect(byStep(tasks, 1).time).toBeNull()
  })

  it('sets every task to the first "planned" status', () => {
    expect(new Set(tasks.map((t) => t.status))).toEqual(new Set(['ts-not-started']))
  })
})

describe('upgrades without UAT', () => {
  const noUat = { ...windows, uat: null }
  const tasks = generateTasks({ template, windows: noUat, family: 'Australia', settings })

  it('keeps UAT-anchored steps but marks them N/A without dates', () => {
    const uatSteps = tasks.filter(
      (t) =>
        t.templateStepId && template.steps.find((s) => s.id === t.templateStepId)?.anchor === 'uat',
    )
    expect(uatSteps).toHaveLength(5)
    for (const t of uatSteps) {
      expect(t.status).toBe('ts-na')
      expect(t.start).toBeNull()
      expect(t.end).toBeNull()
    }
    expect(tasks).toHaveLength(24)
  })

  it('ignores N/A tasks in progress', () => {
    const done = tasks.map((t) => (t.status === 'ts-na' ? t : { ...t, status: 'ts-completed' }))
    expect(progressOf(done, settings.taskStatuses)).toBe(1)
  })

  it('re-activates UAT steps when a UAT window is added', () => {
    const { tasks: re } = recalculateTasks({ tasks, windows }, template, settings, false)
    expect(byStep(re, 12).status).toBe('ts-not-started')
    expect(byStep(re, 12).start).toBe('2026-12-01')
  })
})

describe('recalculate', () => {
  it('keeps manual dates unless asked to overwrite', () => {
    const tasks = generateTasks({ template, windows, family: 'Australia', settings })
    const edited = tasks.map((t, i) =>
      i === 0 ? { ...t, start: '2026-10-01', end: '2026-10-01', datesManuallySet: true } : t,
    )
    const moved = { ...windows, dev: win('2026-11-26T00:15') }
    const keep = recalculateTasks({ tasks: edited, windows: moved }, template, settings, false)
    expect(keep.skippedManual).toBe(1)
    expect(keep.tasks[0]!.start).toBe('2026-10-01')
    const over = recalculateTasks({ tasks: edited, windows: moved }, template, settings, true)
    expect(over.tasks[0]!.start).toBe('2026-11-05')
    expect(over.tasks[0]!.datesManuallySet).toBe(false)
  })
})
