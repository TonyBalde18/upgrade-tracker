import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { emptyDoc } from '@/lib/model/defaults'
import {
  CORE_ID,
  describePart,
  diffParts,
  joinParts,
  mergeParts,
  sameParts,
  splitDoc,
  type Parts,
} from './parts'

const p = (o: Record<string, string>): Parts => new Map(Object.entries(o))

describe('splitDoc / joinParts', () => {
  it('round-trips the demo document exactly', () => {
    const doc = buildDemoDoc()
    const parts = splitDoc(doc)
    expect(parts.has(CORE_ID)).toBe(true)
    expect(parts.size).toBe(1 + doc.customers.length + doc.upgrades.length)
    expect(joinParts(parts)).toEqual(doc)
  })

  it('produces exactly the same text as plain JSON.stringify (cached pieces)', () => {
    const doc = buildDemoDoc()
    const core = {
      schemaVersion: doc.schemaVersion,
      updatedAt: doc.updatedAt,
      settings: doc.settings,
      template: doc.template,
      customerOrder: doc.customers.map((c) => c.id),
      upgradeOrder: doc.upgrades.map((u) => u.id),
    }
    const parts = splitDoc(doc)
    expect(parts.get(CORE_ID)).toBe(JSON.stringify(core))
    const u = doc.upgrades[0]!
    expect(parts.get(`u_${u.id}`)).toBe(JSON.stringify(u))
    // a new object (as Immer creates on edit) is converted again
    const edited = { ...doc, upgrades: [{ ...u, notes: 'changed' }, ...doc.upgrades.slice(1)] }
    expect(JSON.parse(splitDoc(edited).get(`u_${u.id}`)!).notes).toBe('changed')
  })

  it('returns null when nothing is stored', () => {
    expect(joinParts(new Map())).toBeNull()
  })

  it('keeps the order from the core and appends unknown parts', () => {
    const doc = buildDemoDoc()
    const parts = splitDoc(doc)
    const extra = { ...doc.customers[0]!, id: 'zz-new', name: 'Added elsewhere' }
    parts.set('c_zz-new', JSON.stringify(extra))
    const joined = joinParts(parts)!
    expect(joined.customers.map((c) => c.id)).toEqual([...doc.customers.map((c) => c.id), 'zz-new'])
  })

  it('ignores ids in the order whose part was deleted', () => {
    const doc = buildDemoDoc()
    const parts = splitDoc(doc)
    const gone = doc.upgrades[0]!.id
    parts.delete(`u_${gone}`)
    expect(joinParts(parts)!.upgrades.some((u) => u.id === gone)).toBe(false)
  })

  it('fills defaults when only the core is missing', () => {
    const doc = buildDemoDoc()
    const parts = splitDoc(doc)
    parts.delete(CORE_ID)
    const joined = joinParts(parts)!
    expect(joined.customers.length).toBe(doc.customers.length)
    expect(joined.template.steps.length).toBeGreaterThan(0)
  })

  it('throws on unreadable data instead of guessing', () => {
    expect(() => joinParts(p({ core: '{not json' }))).toThrow()
  })

  it('an empty document is just the core', () => {
    expect([...splitDoc(emptyDoc()).keys()]).toEqual([CORE_ID])
  })
})

describe('mergeParts', () => {
  const base = p({ core: 'c0', c_a: 'a0', c_b: 'b0', u_x: 'x0' })

  it('takes remote changes for parts not touched here', () => {
    const local = p({ core: 'c0', c_a: 'a0', c_b: 'b0', u_x: 'x0' })
    const remote = p({ core: 'c1', c_a: 'a1', c_b: 'b0', u_x: 'x0', u_y: 'y1' })
    expect(mergeParts(base, local, remote)).toEqual(remote)
  })

  it('keeps local edits and takes remote edits of other parts', () => {
    const local = p({ core: 'c0', c_a: 'aL', c_b: 'b0', u_x: 'x0' })
    const remote = p({ core: 'c0', c_a: 'a0', c_b: 'bR', u_x: 'x0' })
    expect(mergeParts(base, local, remote)).toEqual(
      p({ core: 'c0', c_a: 'aL', c_b: 'bR', u_x: 'x0' }),
    )
  })

  it('local wins when both changed the same part', () => {
    const local = p({ core: 'c0', c_a: 'aL', c_b: 'b0', u_x: 'x0' })
    const remote = p({ core: 'c0', c_a: 'aR', c_b: 'b0', u_x: 'x0' })
    expect(mergeParts(base, local, remote).get('c_a')).toBe('aL')
  })

  it('applies remote deletions and keeps local additions and deletions', () => {
    const local = p({ core: 'c0', c_a: 'a0', u_x: 'x0', u_new: 'n' }) // deleted b, added new
    const remote = p({ core: 'c0', c_a: 'a0', c_b: 'b0' }) // deleted x
    expect(mergeParts(base, local, remote)).toEqual(p({ core: 'c0', c_a: 'a0', u_new: 'n' }))
  })

  it('on first load (empty base) takes the server version', () => {
    const local = splitDoc(emptyDoc())
    const remote = p({ core: 'server', c_a: 'a' })
    // local core differs from the (empty) base, so the empty local core would win:
    // the engine therefore starts from the server copy, see store/cloud.ts
    expect(mergeParts(new Map(), local, remote).get('c_a')).toBe('a')
  })
})

describe('diffParts / sameParts', () => {
  it('lists what to write and delete', () => {
    const from = p({ core: 'c', c_a: 'a', c_b: 'b' })
    const to = p({ core: 'c', c_a: 'a2', u_x: 'x' })
    expect(diffParts(from, to)).toEqual({
      set: [
        ['c_a', 'a2'],
        ['u_x', 'x'],
      ],
      remove: ['c_b'],
    })
    expect(sameParts(from, to)).toBe(false)
    expect(sameParts(to, new Map(to))).toBe(true)
  })
})

describe('describePart', () => {
  it('names parts for error messages', () => {
    const doc = buildDemoDoc()
    const c = doc.customers[0]!
    expect(describePart(CORE_ID, doc)).toBe('settings and template')
    expect(describePart(`c_${c.id}`, doc)).toBe(`customer ${c.name}`)
    expect(describePart(`u_${doc.upgrades[0]!.id}`, doc)).toMatch(/^upgrade /)
  })
})
