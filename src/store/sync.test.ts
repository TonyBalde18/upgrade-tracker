// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDoc } from '@/lib/model/defaults'
import { saveConnection, saveToken, DEFAULT_CONNECTION } from '@/lib/github/config'
import { base64ToUtf8, commitMessage, testConnection, utf8ToBase64 } from '@/lib/github/client'
import type { TrackerDoc } from '@/lib/model/types'
import { useTracker } from './tracker'
import {
  _resetSyncForTests,
  pull,
  push,
  resolveOverwrite,
  resolveReload,
  syncMeta,
  useConflict,
} from './persistence'

// Node's experimental localStorage hides jsdom's: use an in-memory one
const mem = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  },
})

// --- a tiny fake of the GitHub Contents API ---------------------------------------

interface Server {
  exists: boolean
  text: string
  sha: string
  n: number
  puts: { sha?: string; message: string; text: string }[]
  offline: boolean
  status: number | null // force an error status
}
let server: Server

function docWith(names: string[]): TrackerDoc {
  const d = emptyDoc(new Date('2026-11-04T10:00:00Z'))
  d.customers = names.map((name, i) => ({
    id: `c${i}`,
    name,
    shortName: name.slice(0, 3),
    color: '#E1292C',
    snContact: '',
    consultants: [],
    instances: { dev: '', uat: '', prod: '' },
    notes: '',
    active: true,
  }))
  return d
}

/** Simulate someone else saving on another device. */
function externalSave(names: string[]) {
  server.exists = true
  server.text = JSON.stringify(docWith(names))
  server.sha = `s${++server.n}`
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (server.offline) return Promise.reject(new TypeError('Failed to fetch'))
  const url = String(input)
  const auth = new Headers(init?.headers).get('Authorization')
  expect(auth).toBe('Bearer github_pat_test') // token only in the header
  expect(url).not.toContain('github_pat_test') // never in a URL
  if (server.status) return Promise.resolve(json(server.status, { message: 'Bad credentials' }))
  const method = init?.method ?? 'GET'
  if (url.endsWith('/repos/TonyBalde18/upgrade-tracker-data'))
    return Promise.resolve(
      new Response(JSON.stringify({ private: server.n >= 0 }), {
        status: 200,
        headers: { 'github-authentication-token-expiration': '2027-02-01 10:00:00 UTC' },
      }),
    )
  if (url.includes('/contents/tracker.json')) {
    if (method === 'GET') {
      if (!server.exists) return Promise.resolve(json(404, { message: 'Not Found' }))
      return Promise.resolve(
        json(200, {
          type: 'file',
          encoding: 'base64',
          content: utf8ToBase64(server.text),
          sha: server.sha,
        }),
      )
    }
    const body = JSON.parse(String(init?.body)) as {
      sha?: string
      message: string
      content: string
    }
    if (server.exists && !body.sha)
      return Promise.resolve(json(422, { message: `Invalid request. "sha" wasn't supplied.` }))
    if (server.exists && body.sha !== server.sha)
      return Promise.resolve(json(409, { message: `is at ${server.sha} but expected ${body.sha}` }))
    server.exists = true
    server.text = base64ToUtf8(body.content)
    server.sha = `s${++server.n}`
    server.puts.push({ sha: body.sha, message: body.message, text: server.text })
    return Promise.resolve(json(200, { content: { sha: server.sha } }))
  }
  return Promise.resolve(json(404, { message: 'Not Found' }))
}

const names = () => useTracker.getState().doc.customers.map((c) => c.name)

beforeEach(() => {
  server = { exists: false, text: '', sha: '', n: 0, puts: [], offline: false, status: null }
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  window.localStorage.clear()
  saveConnection({ ...DEFAULT_CONNECTION, mode: 'github' })
  saveToken('github_pat_test')
  _resetSyncForTests()
  useTracker.getState().replaceDoc(emptyDoc())
  useTracker.getState().setHydrated()
})
afterEach(() => vi.unstubAllGlobals())

describe('base64 and commit messages', () => {
  it('round-trips accents and emoji', () => {
    const s = 'Société Générale Zürich – São Paulo ✓'
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s)
  })
  it('builds a meaningful commit message', () => {
    expect(commitMessage(['Acme - Australia: "Upgrade DEV" → Completed'])).toBe(
      'Acme - Australia: "Upgrade DEV" → Completed',
    )
    const m = commitMessage(['A', 'A', 'B', 'C'])
    expect(m.split('\n')[0]).toBe('3 changes: A')
    expect(m).toContain('- B')
  })
})

describe('GitHub sync', () => {
  it('creates tracker.json on the first save, without sha, UTF-8 safe', async () => {
    useTracker.getState().addCustomers(['Société Zürich'])
    await pull({ silent: true })
    expect(server.puts).toHaveLength(1)
    expect(server.puts[0]!.sha).toBeUndefined()
    expect(server.puts[0]!.message).toBe('Add 1 customer')
    expect(JSON.parse(server.text).customers[0].name).toBe('Société Zürich')
    expect(useTracker.getState().pendingChanges).toHaveLength(0)
    expect(syncMeta().baseSha).toBe('s1')
    expect(useTracker.getState().sync.status).toBe('saved')
  })

  it('loads the GitHub version when there are no local edits', async () => {
    externalSave(['From GitHub'])
    await pull({ silent: true })
    expect(names()).toEqual(['From GitHub'])
    expect(syncMeta().baseSha).toBe('s1')
  })

  it('sends later edits with the sha they are based on', async () => {
    externalSave(['Base'])
    await pull({ silent: true })
    useTracker.getState().addCustomers(['New'])
    await push()
    expect(server.puts[0]!.sha).toBe('s1')
    expect(JSON.parse(server.text).customers.map((c: { name: string }) => c.name)).toEqual([
      'Base',
      'New',
    ])
  })

  it('pull with edits on both sides opens the conflict dialog and keeps local edits', async () => {
    externalSave(['Base'])
    await pull({ silent: true })
    externalSave(['Changed elsewhere'])
    useTracker.getState().addCustomers(['Mine'])
    await pull({ silent: true })
    expect(useConflict.getState().conflict?.reason).toBe('pull')
    expect(names()).toEqual(['Base', 'Mine']) // nothing lost
    expect(server.puts).toHaveLength(0) // nothing overwritten
    await push() // blocked while the conflict is open
    expect(server.puts).toHaveLength(0)
  })

  it('a 409 on save opens the conflict; "overwrite" uses the latest sha', async () => {
    externalSave(['Base'])
    await pull({ silent: true })
    externalSave(['Changed elsewhere'])
    useTracker.getState().addCustomers(['Mine'])
    await push()
    expect(useConflict.getState().conflict?.reason).toBe('push')
    expect(useTracker.getState().sync.status).toBe('error')
    await resolveOverwrite()
    expect(useConflict.getState().conflict).toBeNull()
    expect(server.puts.at(-1)!.sha).toBe('s2')
    expect(JSON.parse(server.text).customers.map((c: { name: string }) => c.name)).toEqual([
      'Base',
      'Mine',
    ])
    expect(useTracker.getState().pendingChanges).toHaveLength(0)
  })

  it('"reload" discards local edits and loads GitHub', async () => {
    externalSave(['Base'])
    await pull({ silent: true })
    externalSave(['Changed elsewhere'])
    useTracker.getState().addCustomers(['Mine'])
    await pull({ silent: true })
    await resolveReload()
    expect(names()).toEqual(['Changed elsewhere'])
    expect(useTracker.getState().pendingChanges).toHaveLength(0)
    expect(syncMeta().baseSha).toBe('s2')
  })

  it('keeps edits when offline', async () => {
    externalSave(['Base'])
    await pull({ silent: true })
    useTracker.getState().addCustomers(['Offline edit'])
    server.offline = true
    await push()
    expect(useTracker.getState().sync.status).toBe('offline')
    expect(useTracker.getState().pendingChanges).toEqual(['Add 1 customer'])
    server.offline = false
    await push()
    expect(useTracker.getState().pendingChanges).toHaveLength(0)
  })

  it('reports an invalid or expired token clearly', async () => {
    server.status = 401
    await pull({ silent: true })
    expect(useTracker.getState().sync.status).toBe('error')
    expect(useTracker.getState().sync.message).toMatch(/invalid or has expired/)
  })

  it('never writes a file it has not read first (repo changed in Settings)', async () => {
    externalSave(['Base'])
    useTracker.getState().addCustomers(['Mine'])
    await push() // no base yet: it pulls first and finds edits on both sides
    expect(server.puts).toHaveLength(0)
    expect(useConflict.getState().conflict).not.toBeNull()
  })

  it('Test connection reports token expiry, private repo and a missing file', async () => {
    const r = await testConnection({ ...DEFAULT_CONNECTION, mode: 'github' }, 'github_pat_test')
    expect(r.ok).toBe(true)
    expect(r.tokenExpires).toBe('2027-02-01 10:00:00 UTC')
    expect(r.fileExists).toBe(false)
    expect(r.steps.map((x) => x.label)).toEqual([
      'Token',
      'Access to TonyBalde18/upgrade-tracker-data',
      'File tracker.json on main',
    ])
    server.status = 401
    const bad = await testConnection({ ...DEFAULT_CONNECTION, mode: 'github' }, 'github_pat_test')
    expect(bad.ok).toBe(false)
    expect(bad.steps[0]!.detail).toMatch(/Invalid or expired/)
  })
})
