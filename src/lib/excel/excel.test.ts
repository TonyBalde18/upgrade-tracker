import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildDemoDoc } from '@/demo/demo-data'
import {
  cellLabel,
  dayColumns,
  overviewRows,
  planModel,
  safeFileName,
  safeSheetName,
  windowText,
} from './model'
import { renderOverviewSheet, renderPlanSheet } from './render'

const doc = buildDemoDoc()
const upgrade = doc.upgrades[0]!
const today = upgrade.windows.dev.start.slice(0, 10)

describe('excel model', () => {
  it('labels day cells like the hand-made schedules', () => {
    const l = (name: string, multi = false) => cellLabel({ name, kind: 'task' }, multi)
    expect(l('Upgrade DEV to Australia release')).toBe('UP')
    expect(l('Upgrade Prod to Brazil Release')).toBe('UP')
    expect(l('Schedule clone from Prod to DEV')).toBe('CL')
    expect(l('Freeze on DEV instance', true)).toBe('DEV Freeze')
    expect(l('Freeze on PROD instance (IOC Celebrations)', true)).toBe('PROD Freeze')
    expect(l('User acceptance testing', true)).toBe('UAT')
    expect(l('Upgrade hypercare', true)).toBe('Hypercare')
    expect(l('Go / No-Go call')).toBe('Go/No-Go')
    expect(l('Go or No Go call')).toBe('Go/No-Go')
    expect(l('Documentation')).toBe('•')
    expect(l('Fix UAT testing issues', true)).toBe('Fix UAT testing issues')
  })

  it('covers whole weeks from the first to the last step', () => {
    const days = dayColumns(
      [
        { start: '2026-11-25', end: '2026-11-25' },
        { start: '2026-12-07', end: '2026-12-11' },
      ],
      '2026-11-26',
    )
    expect(days[0]!.date).toBe('2026-11-23') // Monday
    expect(days[days.length - 1]!.date).toBe('2026-12-13') // Sunday
    expect(days.length).toBe(21)
    expect(days.find((d) => d.today)!.date).toBe('2026-11-26')
    expect(days.filter((d) => d.weekend).length).toBe(6)
  })

  it('builds rows grouped by phase with cells inside the day range', () => {
    const plan = planModel(doc, upgrade, today)
    const phases = plan.rows.filter((r) => r.kind === 'phase').map((r) => r.phase)
    expect(phases[0]).toBe('Preparation')
    for (const r of plan.rows) {
      if (r.kind !== 'task' || !r.cells) continue
      expect(r.cells.from).toBeGreaterThanOrEqual(0)
      expect(r.cells.to).toBeLessThan(plan.days.length)
      expect(plan.days[r.cells.from]!.date).toBe(r.start)
    }
    expect(plan.windows.map((w) => w.env)).toEqual(['DEV', 'UAT', 'PROD'])
    expect(plan.fileName).toMatch(/^Acme Corp - Australia Upgrade schedule \d{4}\.xlsx$/)
    expect(plan.title).toContain('Zurich to Australia')
  })

  it('writes window times in their own zone', () => {
    expect(
      windowText({
        start: '2026-11-23T00:15',
        timeZone: 'Europe/Zurich',
        durationHours: 3,
        status: 'x',
        updatedAt: '',
        goNoGo: { decision: 'pending', date: null, by: '' },
      }),
    ).toBe('Mon 23 Nov 2026, 00:15-03:15 CET (Europe/Zurich)')
  })

  it('makes valid, unique sheet and file names', () => {
    const taken = new Set<string>()
    expect(safeSheetName('A/B: C*?', taken)).toBe('A B C')
    expect(safeSheetName('a b c', taken)).toBe('a b c (2)')
    expect(safeSheetName('x'.repeat(40), taken)).toHaveLength(31)
    expect(safeFileName('EDA: The "Council"?.xlsx')).toBe('EDA The Council .xlsx')
  })

  it('lists the overview by PROD date with the next open step', () => {
    const rows = overviewRows(doc, doc.upgrades)
    expect(rows).toHaveLength(doc.upgrades.length)
    const prods = rows.map((r) => r.prod)
    expect(prods.length).toBeGreaterThan(1)
    expect(rows.every((r) => r.progress >= 0 && r.progress <= 1)).toBe(true)
  })
})

describe('excel workbook', () => {
  it('renders a plan and an overview that Excel can open', async () => {
    const wb = new ExcelJS.Workbook()
    const taken = new Set(['overview'])
    renderOverviewSheet(wb, overviewRows(doc, doc.upgrades), today)
    const plan = planModel(doc, upgrade, today, taken)
    renderPlanSheet(wb, plan)
    const buffer = await wb.xlsx.writeBuffer()

    const back = new ExcelJS.Workbook()
    await back.xlsx.load(buffer as ArrayBuffer)
    expect(back.worksheets.map((w) => w.name)).toEqual(['Overview', plan.sheetName])
    const ws = back.getWorksheet(plan.sheetName)!
    expect(String(ws.getCell(1, 1).value)).toContain('Acme Corp')
    expect(ws.getCell(8, 1).value).toBe('Step')
    // the first task row sits under the first phase row
    expect(ws.getCell(9, 1).value).toBe('PREPARATION')
    const firstTask = plan.rows.find((r) => r.kind === 'task')!
    expect(ws.getCell(10, 1).value).toBe(firstTask.kind === 'task' ? firstTask.name : '')
    // the PROD upgrade cell is labelled UP
    const prodRow = plan.rows.findIndex((r) => r.kind === 'task' && /upgrade prod/i.test(r.name))
    const cells = (plan.rows[prodRow] as { cells: { from: number } }).cells
    expect(ws.getCell(9 + prodRow, 7 + cells.from).value).toBe('UP')
    const overview = back.getWorksheet('Overview')!
    expect(overview.getCell(3, 1).value).toBe('Customer')
    expect(overview.getCell(4, 1).value).toBeTruthy()
  })
})
