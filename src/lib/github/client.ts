/**
 * Minimal GitHub REST Contents API client for the private data repo.
 * The token is only ever put in the Authorization header: never in a URL,
 * never logged, never included in error messages.
 */
import type { ConnectionConfig } from './config'

const API = 'https://api.github.com'

export type GitHubErrorKind =
  'auth' | 'notfound' | 'forbidden' | 'rate' | 'conflict' | 'network' | 'toolarge' | 'unknown'

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    public status = 0,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

// --- UTF-8 safe base64 (customer names have accents) ------------------------

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK)
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// --- requests -------------------------------------------------------------------

function contentsUrl(c: ConnectionConfig): string {
  const path = c.path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path}`
}

function headers(token: string, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' })
  } catch {
    throw new GitHubError('network', 'Cannot reach GitHub (offline or blocked by the network).')
  }
}

async function errorFrom(res: Response, what: string): Promise<GitHubError> {
  let apiMessage = ''
  try {
    const body = (await res.json()) as { message?: string }
    apiMessage = body.message ?? ''
  } catch {
    /* no body */
  }
  if (res.status === 401)
    return new GitHubError(
      'auth',
      'The token is invalid or has expired. Create a new one and paste it in Settings.',
      401,
    )
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429)
      return new GitHubError(
        'rate',
        'GitHub rate limit reached. Try again in a few minutes.',
        res.status,
      )
    return new GitHubError(
      'forbidden',
      `The token is not allowed to ${what}. It needs "Contents: Read and write" on the data repository.`,
      403,
    )
  }
  if (res.status === 404)
    return new GitHubError(
      'notfound',
      "Repository not found, or the token has no access to it. Check owner, repository name and the token's repository selection.",
      404,
    )
  if (res.status === 409 || res.status === 422) {
    if (/sha/i.test(apiMessage) || res.status === 409)
      return new GitHubError(
        'conflict',
        'The data on GitHub changed since it was loaded.',
        res.status,
      )
    return new GitHubError(
      'unknown',
      `GitHub refused the request (${res.status}). ${apiMessage}`.trim(),
      res.status,
    )
  }
  return new GitHubError('unknown', `GitHub error ${res.status}. ${apiMessage}`.trim(), res.status)
}

export interface RemoteFile {
  text: string
  sha: string
}

/** Read the data file. Resolves null when it does not exist yet (first run). */
export async function getFile(c: ConnectionConfig, token: string): Promise<RemoteFile | null> {
  const url = `${contentsUrl(c)}?ref=${encodeURIComponent(c.branch)}`
  const res = await request(url, { headers: headers(token) })
  if (res.status === 404) {
    // file missing vs repo missing: check the repo
    const repo = await request(
      `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`,
      { headers: headers(token) },
    )
    if (repo.ok) return null
    throw await errorFrom(repo, 'read the repository')
  }
  if (!res.ok) throw await errorFrom(res, 'read the data file')
  const body = (await res.json()) as {
    content?: string
    encoding?: string
    sha: string
    size?: number
    type?: string
  }
  if (body.type && body.type !== 'file')
    throw new GitHubError('unknown', `"${c.path}" is not a file in the repository.`)
  if (body.encoding === 'base64' && body.content)
    return { text: base64ToUtf8(body.content), sha: body.sha }
  // files over 1 MB come without content: fetch the raw bytes
  const raw = await request(url, { headers: headers(token, 'application/vnd.github.raw+json') })
  if (!raw.ok) throw await errorFrom(raw, 'read the data file')
  return { text: await raw.text(), sha: body.sha }
}

/** Create or update the data file. `sha` is the version it replaces (null to create). Returns the new sha. */
export async function putFile(
  c: ConnectionConfig,
  token: string,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const body: Record<string, string> = { message, content: utf8ToBase64(text), branch: c.branch }
  if (sha) body.sha = sha
  const res = await request(contentsUrl(c), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // creating a file that already exists also comes back as 422 "sha wasn't supplied"
    throw await errorFrom(res, 'write the data file')
  }
  const out = (await res.json()) as { content: { sha: string } }
  return out.content.sha
}

export interface ConnectionReport {
  ok: boolean
  steps: { label: string; ok: boolean; detail?: string }[]
  tokenExpires: string | null
  fileExists: boolean | null
}

/** Check token, repository access and the data file, step by step, for the Settings screen. */
export async function testConnection(
  c: ConnectionConfig,
  token: string,
): Promise<ConnectionReport> {
  const report: ConnectionReport = { ok: false, steps: [], tokenExpires: null, fileExists: null }
  if (!token) {
    report.steps.push({ label: 'Token', ok: false, detail: 'No token saved yet.' })
    return report
  }
  if (!c.owner || !c.repo || !c.path) {
    report.steps.push({
      label: 'Settings',
      ok: false,
      detail: 'Owner, repository and file path are required.',
    })
    return report
  }
  let repoRes: Response
  try {
    repoRes = await request(
      `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`,
      { headers: headers(token) },
    )
  } catch (e) {
    report.steps.push({
      label: 'Reach GitHub',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    })
    return report
  }
  report.tokenExpires = repoRes.headers.get('github-authentication-token-expiration')
  if (repoRes.status === 401) {
    report.steps.push({ label: 'Token', ok: false, detail: 'Invalid or expired token.' })
    return report
  }
  report.steps.push({
    label: 'Token',
    ok: true,
    detail: report.tokenExpires ? `Valid, expires ${report.tokenExpires}` : 'Valid',
  })
  if (!repoRes.ok) {
    const err = await errorFrom(repoRes, 'read the repository')
    report.steps.push({ label: `Access to ${c.owner}/${c.repo}`, ok: false, detail: err.message })
    return report
  }
  const repo = (await repoRes.json()) as { private?: boolean; permissions?: { push?: boolean } }
  report.steps.push({
    label: `Access to ${c.owner}/${c.repo}`,
    ok: true,
    detail: repo.private
      ? 'Private repository'
      : 'Warning: this repository is PUBLIC. Make it private.',
  })
  if (repo.private === false) report.steps[report.steps.length - 1]!.ok = false
  try {
    const file = await getFile(c, token)
    report.fileExists = file != null
    report.steps.push({
      label: `File ${c.path} on ${c.branch}`,
      ok: true,
      detail: file
        ? `Found (${Math.round(file.text.length / 1024)} KB)`
        : 'Not created yet: the first save creates it.',
    })
  } catch (e) {
    report.steps.push({
      label: `File ${c.path} on ${c.branch}`,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    })
    return report
  }
  report.ok = report.steps.every((s) => s.ok)
  return report
}

/** One-line subject + bullet body from the edit descriptions collected since the last save. */
export function commitMessage(changes: string[]): string {
  const clean: string[] = []
  for (const c of changes) if (c && clean[clean.length - 1] !== c) clean.push(c)
  if (clean.length === 0) return 'Update tracker data'
  if (clean.length === 1) return clean[0]!
  const subject = `${clean.length} changes: ${clean[0]}`
  const short = subject.length > 72 ? `${subject.slice(0, 71)}…` : subject
  const body = clean.slice(0, 60).map((c) => `- ${c}`)
  if (clean.length > 60) body.push(`- …and ${clean.length - 60} more`)
  return `${short}\n\n${body.join('\n')}`
}
