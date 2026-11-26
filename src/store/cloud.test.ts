// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { emptyDoc } from '@/lib/model/defaults'
import { splitDoc } from '@/lib/cloud/parts'

// --- a tiny in-memory fake of Firestore ----------------------------------------------

interface FakeSnap {
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
  empty: boolean
  docs: { id: string; get: (k: string) => unknown }[]
}

const server = vi.hoisted(() => ({
  docs: new Map<string, string>(),
  listener: null as null | ((s: unknown) => void),
  onError: null as null | ((e: unknown) => void),
  writes: [] as string[],
  failNextCommit: null as null | { code: string; message: string },
  access: new Map<string, { ownerUid: string }>(),
}))

function snapshot(fromCache = false): FakeSnap {
  return {
    metadata: { fromCache, hasPendingWrites: false },
    empty: server.docs.size === 0,
    docs: [...server.docs].map(([id, json]) => ({
      id,
      get: (k) => (k === 'json' ? json : undefined),
    })),
  }
}
const emit = (fromCache = false) => server.listener?.(snapshot(fromCache))

vi.mock('@/lib/cloud/firebase', () => ({ firestore: () => ({}) }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_ref: unknown, id: string) => ({ id }),
  onSnapshot: (
    _ref: unknown,
    _opts: unknown,
    next: (s: unknown) => void,
    error: (e: unknown) => void,
  ) => {
    server.listener = next
    server.onError = error
    return () => {
      server.listener = null
    }
  },
  writeBatch: () => {
    const ops: (() => void)[] = []
    return {
      set: (r: { id: string }, data: { json: string }) =>
        ops.push(() => {
          server.docs.set(r.id, data.json)
          server.writes.push(`set ${r.id}`)
        }),
      delete: (r: { id: string }) =>
        ops.push(() => {
          server.docs.delete(r.id)
          server.writes.push(`delete ${r.id}`)
        }),
      commit: () => {
        if (server.failNextCommit) {
          const e = server.failNextCommit
          server.failNextCommit = null
          return Promise.reject(e)
        }
        ops.forEach((o) => o())
        emit()
        return Promise.resolve()
      },
    }
  },
  waitForPendingWrites: () => Promise.resolve(),
  getDoc: (r: { id: string }) =>
    Promise.resolve({
      exists: () => server.access.has(r.id),
      get: (k: string) => (server.access.get(r.id) as Record<string, unknown> | undefined)?.[k],
    }),
  getDocs: () => Promise.resolve({ docs: [] }),
  setDoc: (r: { id: string }, data: { ownerUid: string }) => {
    server.access.set(r.id, data)
    return Promise.resolve()
  },
  deleteDoc: (r: { id: string }) => {
    server.access.delete(r.id)
    return Promise.resolve()
  },
  query: () => ({}),
  where: () => ({}),
}))

const { useTracker } = await import('./tracker')
const { useAuth } = await import('./auth')
const { addViewer, flush, resolveAccess, startCloudSync, stopCloudSync } = await import('./cloud')

const tick = () => new Promise((r) => setTimeout(r, 0))

function seedServer(doc = buildDemoDoc()) {
  server.docs = new Map(splitDoc(doc))
}

beforeEach(() => {
  server.docs = new Map()
  server.writes = []
  server.failNextCommit = null
  server.access = new Map()
  useAuth.setState({ role: 'owner' })
  useTracker.setState({ hydrated: false })
  useTracker.getState().replaceDoc(emptyDoc())
  useAuth.setState({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.c', name: '' } })
})
afterEach(() => stopCloudSync())

describe('cloud sync', () => {
  it('waits for the server when the offline copy is empty, then loads', () => {
    startCloudSync('u1')
    emit(true) // the offline copy answers first: empty (nothing downloaded yet)
    expect(useTracker.getState().hydrated).toBe(false)
    const demo = buildDemoDoc()
    seedServer(demo)
    emit()
    const s = useTracker.getState()
    expect(s.hydrated).toBe(true)
    expect(s.doc).toEqual(demo)
    expect(s.sync.status).toBe('saved')
    expect(server.writes).toEqual([])
  })

  it('an empty database opens empty and writes nothing until the first edit', async () => {
    startCloudSync('u1')
    emit()
    expect(useTracker.getState().hydrated).toBe(true)
    expect(server.writes).toEqual([])
    useTracker.getState().addCustomers(['New customer'])
    flush()
    await tick()
    expect(server.writes.some((w) => w.startsWith('set c_'))).toBe(true)
    expect(server.writes).toContain('set core')
  })

  it('writes only the parts that changed', async () => {
    seedServer()
    startCloudSync('u1')
    emit()
    const c = useTracker.getState().doc.customers[0]!
    useTracker.getState().upsertCustomer({ ...c, notes: 'changed' })
    flush()
    await tick()
    // the customer part, plus the core because every edit bumps updatedAt
    expect(server.writes.sort()).toEqual([`set c_${c.id}`, 'set core'])
    expect(useTracker.getState().sync.status).toBe('saved')
  })

  it('deletes the part of a removed upgrade', async () => {
    seedServer()
    startCloudSync('u1')
    emit()
    const u = useTracker.getState().doc.upgrades[0]!
    useTracker.getState().commit('Delete', (d) => {
      d.upgrades = d.upgrades.filter((x) => x.id !== u.id)
    })
    flush()
    await tick()
    expect(server.writes).toContain(`delete u_${u.id}`)
    expect(server.docs.has(`u_${u.id}`)).toBe(false)
  })

  it('merges a change from another device with an unsaved local edit', async () => {
    seedServer()
    startCloudSync('u1')
    emit()
    const [a, b] = useTracker.getState().doc.customers
    // local edit, not saved yet
    useTracker.getState().upsertCustomer({ ...a!, notes: 'local' })
    // another device edits customer b
    server.docs.set(`c_${b!.id}`, JSON.stringify({ ...b!, notes: 'remote' }))
    emit()
    const doc = useTracker.getState().doc
    expect(doc.customers.find((c) => c.id === a!.id)!.notes).toBe('local')
    expect(doc.customers.find((c) => c.id === b!.id)!.notes).toBe('remote')
    flush()
    await tick()
    expect(JSON.parse(server.docs.get(`c_${a!.id}`)!).notes).toBe('local')
    expect(JSON.parse(server.docs.get(`c_${b!.id}`)!).notes).toBe('remote')
  })

  it('shows a customer added on another device', () => {
    seedServer()
    startCloudSync('u1')
    emit()
    const c = useTracker.getState().doc.customers[0]!
    server.docs.set(
      'c_other-device',
      JSON.stringify({ ...c, id: 'other-device', name: 'From laptop' }),
    )
    emit()
    expect(useTracker.getState().doc.customers.some((x) => x.name === 'From laptop')).toBe(true)
  })

  it('never overwrites data it can not read', async () => {
    seedServer()
    server.docs.set('core', '{broken')
    startCloudSync('u1')
    emit()
    expect(useTracker.getState().sync.status).toBe('error')
    useTracker.getState().addCustomers(['X'])
    flush()
    await tick()
    expect(server.writes).toEqual([])
    expect(server.docs.get('core')).toBe('{broken')
  })

  it('switches to the no-access screen when the rules deny this account', () => {
    startCloudSync('u1')
    server.onError?.({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })
    expect(useAuth.getState().status).toBe('denied')
  })

  it('reports a failed save and keeps the edit', async () => {
    seedServer()
    startCloudSync('u1')
    emit()
    server.failNextCommit = { code: 'unavailable', message: 'Service unavailable' }
    useTracker.getState().addCustomers(['Kept'])
    flush()
    await tick()
    expect(useTracker.getState().sync.status).toBe('error')
    expect(useTracker.getState().doc.customers.some((c) => c.name === 'Kept')).toBe(true)
  })
})

describe('view-only access', () => {
  it('opens the shared tracker for someone on the access list', async () => {
    expect(await resolveAccess('colleague-uid', 'Colleague@Example.com')).toEqual({
      role: 'owner',
      dataUid: 'colleague-uid',
    })
    await addViewer('owner-uid', 'Colleague@Example.com')
    expect(await resolveAccess('colleague-uid', 'colleague@example.com')).toEqual({
      role: 'viewer',
      dataUid: 'owner-uid',
    })
    // the owner never becomes a viewer of their own tracker
    expect((await resolveAccess('owner-uid', 'colleague@example.com')).role).toBe('owner')
  })

  it('a viewer sees live changes but nothing is ever written', async () => {
    seedServer()
    useAuth.setState({ role: 'viewer' })
    startCloudSync('owner-uid', { readOnly: true })
    emit()
    expect(useTracker.getState().doc.customers.length).toBeGreaterThan(0)
    // edits are refused in the store
    useTracker.getState().addCustomers(['Should not appear'])
    expect(useTracker.getState().doc.customers.some((c) => c.name === 'Should not appear')).toBe(
      false,
    )
    useTracker.getState().replaceDoc(emptyDoc(), { dirty: true, description: 'Clear all data' })
    expect(useTracker.getState().doc.customers.length).toBeGreaterThan(0)
    // even a change that slips past the store is never sent
    useTracker.setState((st) => {
      st.doc.customers[0]!.notes = 'local only'
    })
    flush()
    await tick()
    expect(server.writes).toEqual([])
    // changes by the owner still arrive
    const c = useTracker.getState().doc.customers[1]!
    server.docs.set(`c_${c.id}`, JSON.stringify({ ...c, notes: 'from owner' }))
    emit()
    expect(useTracker.getState().doc.customers[1]!.notes).toBe('from owner')
  })
})
