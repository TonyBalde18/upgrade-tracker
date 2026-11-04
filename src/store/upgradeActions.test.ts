import { beforeEach, describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { useTracker, undo } from './tracker'
import {
  addTask,
  applyTemplateToUpgrade,
  deleteTask,
  recalculate,
  setUat,
  shiftDates,
  updateStep,
  updateTask,
  updateUpgradeMeta,
  updateWindow,
} from './upgradeActions'

const U = 'demo-upg-1' // Acme, has UAT
const doc = () => useTracker.getState().doc
const upg = () => doc().upgrades.find((u) => u.id === U)!
const task = (step: string) => upg().tasks.find((t) => t.templateStepId === step)!

beforeEach(() => {
  useTracker.getState().replaceDoc(buildDemoDoc(new Date('2026-11-04T10:00:00Z')))
})

describe('upgrade actions', () => {
  it('logs status changes and writes a readable commit description', () => {
    updateTask(U, task('step-09').id, { status: 'ts-blocked' })
    expect(upg().log[0]!.text).toMatch(/"Upgrade DEV to Australia release": .* → Blocked/)
    expect(useTracker.getState().pendingChanges.at(-1)).toBe(
      'Acme Corp - Australia: "Upgrade DEV to Australia release" → Blocked',
    )
  })

  it('marks edited dates as manual, keeps start <= end and milestones single-day', () => {
    const t = task('step-10') // 3-day task
    updateTask(U, t.id, { end: '2020-01-01' })
    const after = task('step-10')
    expect(after.datesManuallySet).toBe(true)
    expect(after.end).toBe(after.start)
    const m = task('step-18') // milestone
    updateTask(U, m.id, { start: '2026-12-01' })
    expect(task('step-18').end).toBe('2026-12-01')
  })

  it('recalculate keeps manual dates unless asked', () => {
    const t = task('step-01')
    updateTask(U, t.id, { start: '2026-01-05' })
    updateWindow(U, 'dev', { start: '2026-11-30T00:15' })
    const r = recalculate(U, false)
    expect(r.skipped).toBe(1)
    expect(task('step-01').start).toBe('2026-01-05')
    recalculate(U, true)
    expect(task('step-01').start).toBe('2026-11-09')
  })

  it('renames generated task names when the target release changes', () => {
    updateUpgradeMeta(U, { family: 'Brazil' })
    expect(task('step-21').name).toBe('Upgrade Prod to Brazil release')
    updateTask(U, task('step-09').id, { name: 'My own name' })
    updateUpgradeMeta(U, { family: 'Canada' })
    expect(task('step-09').name).toBe('My own name')
  })

  it('UAT N/A and back, with undo', () => {
    setUat(U, null)
    expect(upg().windows.uat).toBeNull()
    expect(task('step-12').status).toBe('ts-na')
    undo()
    expect(upg().windows.uat).not.toBeNull()
  })

  it('adds, deletes and shifts tasks', () => {
    const before = upg().tasks.length
    const id = addTask(U, 'UAT')
    expect(upg().tasks).toHaveLength(before + 1)
    const added = upg().tasks.find((t) => t.id === id)!
    const lastUat = [...upg().tasks]
      .filter((t) => t.phase === 'UAT')
      .sort((a, b) => a.order - b.order)
      .at(-1)!
    expect(lastUat.id).toBe(id)
    expect(added.templateStepId).toBeNull()
    deleteTask(U, id)
    expect(upg().tasks).toHaveLength(before)
    const prodBefore = upg().windows.prod.start
    shiftDates(U, 7, true)
    expect(upg().windows.prod.start).not.toBe(prodBefore)
  })

  it('applies template changes only when asked', () => {
    updateStep('step-24', { name: 'Final documentation' })
    expect(task('step-24').name).toBe('Documentation')
    applyTemplateToUpgrade(U)
    expect(task('step-24').name).toBe('Final documentation')
  })
})
