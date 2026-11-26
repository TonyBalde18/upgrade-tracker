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
  moveWindow,
  addExtraWindow,
  bulkUpdateTasks,
  removeExtraWindow,
  renameWord,
  setEnvNames,
  updateExtraWindow,
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

  it('moves a window alone or with its dependent tasks', () => {
    const prod = upg().windows.prod.start
    const golive = task('step-18').start!
    const dev = task('step-01').start!
    moveWindow(U, 'prod', 7, false)
    expect(upg().windows.prod.start.slice(10)).toBe(prod.slice(10)) // keeps the time
    expect(task('step-18').start).toBe(golive)
    undo()
    moveWindow(U, 'prod', 7, true)
    expect(task('step-18').start).not.toBe(golive)
    expect(task('step-01').start).toBe(dev) // DEV-anchored tasks stay
    expect(upg().log[0]!.text).toContain('(9 task(s) moved too)')
  })
})

describe('environments, extra windows, bulk edit', () => {
  it('renames the test environment in step names of that customer only', () => {
    const c = doc().customers.find((x) => x.id === upg().customerId)!
    const other = doc().upgrades.find((u) => u.customerId !== c.id)!
    setEnvNames(c.id, { ...c.envNames, uat: 'PRP' })
    expect(doc().customers.find((x) => x.id === c.id)!.envNames.uat).toBe('PRP')
    expect(task('step-12').name).toBe('Upgrade PRP to Australia release')
    expect(task('step-11').name).toBe('Schedule clone from Prod to PRP')
    // "User acceptance testing" has no whole-word UAT and stays
    expect(task('step-14').name).toBe('User acceptance testing')
    expect(other.tasks.some((t) => t.name.includes('PRP'))).toBe(false)
    expect(upg().log[0]!.text).toMatch(/UAT renamed to PRP/)
    undo()
    expect(task('step-12').name).toBe('Upgrade UAT to Australia release')
  })

  it('renameWord only replaces whole words', () => {
    expect(renameWord('Fix UAT testing issues', 'UAT', 'STAG')).toBe('Fix STAG testing issues')
    expect(renameWord('UATX and UAT-2', 'UAT', 'TEST')).toBe('UATX and TEST-2')
  })

  it('new upgrades use the customer test name', () => {
    const c = doc().customers.find((x) => x.id === upg().customerId)!
    setEnvNames(c.id, { ...c.envNames, uat: 'STAG' })
    applyTemplateToUpgrade(U)
    expect(task('step-12').name).toBe('Upgrade STAG to Australia release')
  })

  it('adds, edits and removes an extra window', () => {
    const id = addExtraWindow(U, 'TEMP')
    expect(upg().extraWindows).toHaveLength(1)
    updateExtraWindow(U, id, { goNoGo: { decision: 'go', date: '2026-12-01', by: 'SDM' } })
    expect(upg().extraWindows[0]!.goNoGo.decision).toBe('go')
    expect(upg().log[0]!.text).toMatch(/TEMP Go \/ No-Go: Pending → Go/)
    shiftDates(U, 7, true)
    removeExtraWindow(U, id)
    expect(upg().extraWindows).toHaveLength(0)
  })

  it('records a Go / No-Go decision in the log', () => {
    updateWindow(U, 'prod', { goNoGo: { decision: 'nogo', date: '2026-12-01', by: 'Customer' } })
    expect(upg().windows.prod.goNoGo).toEqual({
      decision: 'nogo',
      date: '2026-12-01',
      by: 'Customer',
    })
    expect(upg().log[0]!.text).toMatch(/PROD Go \/ No-Go: Pending → No-Go/)
  })

  it('changes several steps at once in one undo step', () => {
    const ids = [task('step-01').id, task('step-02').id, task('step-03').id]
    const before = task('step-02').start!
    expect(bulkUpdateTasks(U, ids, { assignedTo: 'Ana' })).toBe(3)
    expect(ids.every((id) => upg().tasks.find((t) => t.id === id)!.assignedTo === 'Ana')).toBe(true)
    bulkUpdateTasks(U, ids, { shiftDays: 2 })
    expect(task('step-02').start).not.toBe(before)
    expect(task('step-02').datesManuallySet).toBe(true)
    undo()
    expect(task('step-02').start).toBe(before)
    undo()
    expect(task('step-01').assignedTo).toBe('')
  })
})
