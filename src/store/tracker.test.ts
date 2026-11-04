import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDoc } from '@/lib/model/defaults'
import { buildDemoDoc } from '@/demo/demo-data'
import { redo, undo, useTracker } from './tracker'

beforeEach(() => {
  useTracker.getState().replaceDoc(emptyDoc())
})

describe('store', () => {
  it('records edits for undo/redo and collects change descriptions', () => {
    const s = useTracker.getState()
    expect(s.addCustomers(['Alpha', 'Beta', 'alpha', ' '])).toBe(2)
    expect(useTracker.getState().doc.customers.map((c) => c.name)).toEqual(['Alpha', 'Beta'])
    expect(useTracker.getState().pendingChanges).toContain('Add 2 customers')
    undo()
    expect(useTracker.getState().doc.customers).toHaveLength(0)
    redo()
    expect(useTracker.getState().doc.customers).toHaveLength(2)
  })

  it('does not record settings changes made without history', () => {
    useTracker.getState().updateSettings({ theme: 'light' }, 'Theme', { history: false })
    expect(useTracker.temporal.getState().pastStates).toHaveLength(0)
    expect(useTracker.getState().doc.settings.theme).toBe('light')
  })

  it('reassigns items when a status is deleted', () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const before = useTracker
      .getState()
      .doc.upgrades.flatMap((u) => u.tasks)
      .filter((t) => t.status === 'ts-blocked').length
    expect(before).toBeGreaterThan(0)
    useTracker.getState().deleteStatus('taskStatuses', 'ts-blocked', 'ts-in-progress')
    const doc = useTracker.getState().doc
    expect(doc.settings.taskStatuses.some((s) => s.id === 'ts-blocked')).toBe(false)
    expect(doc.upgrades.flatMap((u) => u.tasks).some((t) => t.status === 'ts-blocked')).toBe(false)
  })

  it('renames an assignee everywhere', () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    useTracker.getState().renamePerson('assignees', 'MS team', 'Managed Services')
    const doc = useTracker.getState().doc
    expect(doc.settings.assignees).toContain('Managed Services')
    expect(doc.template.steps.some((s) => s.defaultAssignee === 'MS team')).toBe(false)
    expect(doc.upgrades.flatMap((u) => u.tasks).some((t) => t.assignee === 'MS team')).toBe(false)
  })

  it('keeps unchanged parts of the document by reference (cheap re-renders)', () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const before = useTracker.getState().doc
    useTracker.getState().updateSettings({ displayTimeZone: 'Europe/London' })
    const after = useTracker.getState().doc
    expect(after).not.toBe(before)
    expect(after.upgrades).toBe(before.upgrades)
    expect(after.customers).toBe(before.customers)
  })
})
