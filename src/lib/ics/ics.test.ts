import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { buildIcs, escapeText, foldLine, sequenceOf, slug, uidFor } from '.'

const now = new Date('2026-11-04T10:00:00Z')
const doc = buildDemoDoc(now)
const base = {
  customers: doc.customers,
  settings: doc.settings,
  template: doc.template,
  appUrl: 'https://tonybalde18.github.io/upgrade-tracker/',
  now,
}
const acme = doc.upgrades[0]!
const lines = (text: string) => text.split('\r\n')

describe('text escaping and folding', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('folds at 75 octets and never splits a UTF-8 character', () => {
    const long = `SUMMARY:${'é'.repeat(80)}`
    const folded = foldLine(long)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    const enc = new TextEncoder()
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    // unfolding gives the original back
    expect(folded.replace(/\r\n /g, '')).toBe(long)
  })

  it('leaves short lines alone', () => {
    expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0')
  })
})

describe('UIDs and SEQUENCE', () => {
  it('are stable per item and grow when the item changes', () => {
    expect(uidFor('upg_1', 'tsk_2')).toBe('upg_1-tsk_2@upgrade-tracker')
    const a = sequenceOf('2026-11-04T10:00:00.000Z')
    const b = sequenceOf('2026-11-04T10:05:00.000Z')
    expect(b).toBeGreaterThan(a)
    expect(sequenceOf('nonsense')).toBe(0)
  })

  it('export twice gives the same UIDs', () => {
    const one = buildIcs({ ...base, upgrades: [acme], scope: 'all' }).text
    const two = buildIcs({
      ...base,
      upgrades: [acme],
      scope: 'all',
      now: new Date('2026-11-05T10:00:00Z'),
    }).text
    const uids = (t: string) => lines(t).filter((l) => l.startsWith('UID:'))
    expect(uids(one)).toEqual(uids(two))
  })
})

describe('calendar content', () => {
  it('is a valid VCALENDAR with CRLF endings', () => {
    const { text } = buildIcs({ ...base, upgrades: [acme], scope: 'windows' })
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(lines(text).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(3)
  })

  it('writes windows as timed UTC events with the right title and duration', () => {
    const { text } = buildIcs({ ...base, upgrades: [acme], scope: 'windows' })
    const unfolded = text.replace(/\r\n /g, '')
    expect(unfolded).toContain('SUMMARY:[Acme Corp] Upgrade PROD → Australia')
    // PROD: demo is 00:15 Europe/Zurich, 4 days after 4 Nov = 8 Nov 2026 (CET, UTC+1)
    expect(unfolded).toContain('DTSTART:20261107T231500Z')
    expect(unfolded).toContain('DTEND:20261108T021500Z') // 3 hours
    expect(unfolded).toContain(`UID:${acme.id}-window-prod@upgrade-tracker`)
    expect(unfolded).toContain(
      'Open in Upgrade Tracker: https://tonybalde18.github.io/upgrade-tracker/#/upgrades/',
    )
  })

  it('writes multi-day tasks as all-day events with an exclusive end', () => {
    const { text } = buildIcs({ ...base, upgrades: [acme], scope: 'all' })
    const unfolded = text.replace(/\r\n /g, '')
    const hyper = acme.tasks.find((t) => t.templateStepId === 'step-23')! // 10 days
    expect(unfolded).toContain(`DTSTART;VALUE=DATE:${hyper.start!.replace(/-/g, '')}`)
    const endPlusOne = new Date(`${hyper.end}T00:00:00Z`)
    endPlusOne.setUTCDate(endPlusOne.getUTCDate() + 1)
    expect(unfolded).toContain(
      `DTEND;VALUE=DATE:${endPlusOne.toISOString().slice(0, 10).replace(/-/g, '')}`,
    )
    expect(unfolded).toMatch(/DESCRIPTION:.*Owner: P4M\\nAssignee: MS team\\nStatus: /)
  })

  it('respects the scope and skips N/A and window tasks', () => {
    const w = buildIcs({ ...base, upgrades: [acme], scope: 'windows' }).count
    const m = buildIcs({ ...base, upgrades: [acme], scope: 'milestones' }).count
    const a = buildIcs({ ...base, upgrades: [acme], scope: 'all' }).count
    expect(w).toBe(3)
    expect(m).toBeGreaterThan(w)
    expect(a).toBeGreaterThan(m)
    // 24 steps - 3 "Upgrade X" steps (exported as windows) + 3 windows
    expect(a).toBe(24)
    const globex = doc.upgrades[1]! // no UAT: 5 UAT steps N/A, 1 window less
    expect(buildIcs({ ...base, upgrades: [globex], scope: 'all' }).count).toBe(24 - 5 - 2 + 2)
  })

  it('exports only upcoming items with "from"', () => {
    const all = buildIcs({ ...base, upgrades: doc.upgrades, scope: 'all' }).count
    const upcoming = buildIcs({
      ...base,
      upgrades: doc.upgrades,
      scope: 'all',
      from: '2026-11-04',
    }).count
    expect(upcoming).toBeLessThan(all)
  })

  it('makes file names safe', () => {
    expect(slug('Société Générale / Zürich')).toBe('societe-generale-zurich')
  })
})
