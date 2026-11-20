/**
 * Writes PlanModel / OverviewRow data into an exceljs workbook. No browser APIs:
 * images arrive as PNG/JPEG data URLs already converted by the caller.
 */
import type { Workbook, Worksheet, Fill, Borders } from 'exceljs'
import { formatDay, isoWeekOf, parseDay } from '@/lib/dates'
import { CATEGORY_FILL, LEGEND, type OverviewRow, type PlanModel } from './model'

export interface PlanImages {
  customer?: string
  from?: string
  to?: string
}

const BRAND_RED = 'FFE1292C'
const INK = 'FF0F0100'
const MUTED = 'FF595959'
const HEADER_FILL = 'FF262626'
const PHASE_FILL = 'FFF2F2F2'
const WEEKEND_FILL = 'FFEDEDED'
const GRID = 'FFD9D9D9'
const LABEL_COLS = 6 // Step, Owner, Assignee, Status, Start, End
const HEADER_ROWS = 8

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = { style: 'thin' as const, color: { argb: GRID } }
const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin }

/** "2026-11-23" -> a date Excel shows as 23 Nov 2026 (no time-zone shift). */
const excelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

function addImage(
  wb: Workbook,
  ws: Worksheet,
  dataUrl: string | undefined,
  col: number,
  row: number,
  w: number,
  h: number,
) {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl ?? '')
  if (!m) return
  const id = wb.addImage({ base64: m[2]!, extension: m[1] as 'png' | 'jpeg' })
  ws.addImage(id, { tl: { col, row }, ext: { width: w, height: h }, editAs: 'oneCell' })
}

export function renderPlanSheet(wb: Workbook, plan: PlanModel, images: PlanImages = {}): Worksheet {
  const ws = wb.addWorksheet(plan.sheetName, {
    views: [{ state: 'frozen', xSplit: LABEL_COLS, ySplit: HEADER_ROWS, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: '&L&8&A&R&8Page &P of &N' },
  })
  const firstDay = LABEL_COLS + 1
  const lastCol = LABEL_COLS + Math.max(1, plan.days.length)
  ws.columns = [
    { width: 50 },
    { width: 14 },
    { width: 11 },
    { width: 13 },
    { width: 12 },
    { width: 12 },
    ...plan.days.map(() => ({ width: 4.3 })),
  ]

  // --- title block (rows 1-4) ---------------------------------------------------------
  const hasLogo = Boolean(images.customer)
  const indent = hasLogo ? '                  ' : ''
  ws.getRow(1).height = 30
  const title = ws.getCell(1, 1)
  title.value = indent + plan.title
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: INK } }
  title.alignment = { vertical: 'middle' }
  const sub = ws.getCell(2, 1)
  sub.value = indent + plan.subtitle
  sub.font = { size: 10, color: { argb: MUTED } }
  addImage(wb, ws, images.customer, 0.1, 0.15, 110, 42)

  plan.windows.forEach((w, i) => {
    const cell = ws.getCell(3, 2 + i * 2)
    cell.value = {
      richText: [
        { text: `${w.env}  `, font: { bold: true, size: 9, color: { argb: BRAND_RED } } },
        { text: w.text, font: { size: 9, color: { argb: INK } } },
      ],
    }
  })
  ws.getCell(3, 1).value = indent + 'Upgrade windows'
  ws.getCell(3, 1).font = { size: 9, bold: true, color: { argb: MUTED } }
  ws.getRow(3).height = 18

  // release badges, right of the title
  const badgeCol = Math.min(lastCol - 3, LABEL_COLS + 1)
  addImage(wb, ws, images.from, badgeCol, 0.1, 34, 34)
  addImage(wb, ws, images.to, badgeCol + 2.2, 0.1, 34, 34)

  // --- calendar header (rows 5-8) ---------------------------------------------------
  const headerCell = (
    row: number,
    col: number,
    value: string | number,
    opts: { fill?: string; color?: string; bold?: boolean; size?: number } = {},
  ) => {
    const c = ws.getCell(row, col)
    c.value = value
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.font = {
      size: opts.size ?? 9,
      bold: opts.bold ?? true,
      color: { argb: opts.color ?? 'FFFFFFFF' },
    }
    c.fill = solid(opts.fill ?? HEADER_FILL)
    c.border = box
    return c
  }
  // month and ISO-week bands
  const bands = (row: number, keyOf: (iso: string) => string) => {
    let start = 0
    plan.days.forEach((d, i) => {
      const next = plan.days[i + 1]
      if (!next || keyOf(next.date) !== keyOf(d.date)) {
        headerCell(row, firstDay + start, keyOf(d.date), { size: 9 })
        if (i > start) ws.mergeCells(row, firstDay + start, row, firstDay + i)
        start = i + 1
      }
    })
  }
  bands(5, (iso) => formatDay(iso, 'MMMM yyyy'))
  bands(6, (iso) => `W${isoWeekOf(iso).week}`)
  plan.days.forEach((d, i) => {
    const col = firstDay + i
    const fill = d.today ? BRAND_RED : d.weekend ? 'FF7F7F7F' : HEADER_FILL
    headerCell(7, col, formatDay(d.date, 'EEEEEE'), { fill, bold: false, size: 8 })
    headerCell(8, col, parseDay(d.date).getDate(), { fill })
  })
  ;['Step', 'Owner', 'Assignee', 'Status', 'Start', 'End'].forEach((h, i) => {
    headerCell(8, i + 1, h, { fill: HEADER_FILL }).alignment = {
      horizontal: i === 0 ? 'left' : 'center',
      vertical: 'middle',
      indent: i === 0 ? 1 : 0,
    }
    for (const r of [5, 6, 7]) {
      const c = ws.getCell(r, i + 1)
      c.fill = solid(HEADER_FILL)
    }
  })
  ws.getCell(7, 1).value = 'Today is marked in red'
  ws.getCell(7, 1).font = { size: 8, italic: true, color: { argb: 'FFBFBFBF' } }
  ws.getRow(8).height = 18

  // --- step rows ----------------------------------------------------------------------
  let r = HEADER_ROWS + 1
  for (const row of plan.rows) {
    if (row.kind === 'phase') {
      for (let c = 1; c <= lastCol; c++) {
        const cell = ws.getCell(r, c)
        cell.fill = solid(PHASE_FILL)
        cell.border = { top: thin, bottom: thin }
      }
      const cell = ws.getCell(r, 1)
      cell.value = row.phase.toUpperCase()
      cell.font = { size: 9, bold: true, color: { argb: BRAND_RED } }
      cell.alignment = { indent: 1, vertical: 'middle' }
      ws.getRow(r).height = 16
      r++
      continue
    }
    const style = CATEGORY_FILL[row.category]
    const values: (string | Date | null)[] = [
      row.name,
      row.owner,
      row.assignee,
      row.status,
      row.start ? excelDate(row.start) : null,
      row.end ? excelDate(row.end) : null,
    ]
    values.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = v
      cell.border = { bottom: thin }
      cell.font = { size: 10, color: { argb: INK } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: i === 0 ? 'left' : 'center',
        indent: i === 0 ? 1 : 0,
        wrapText: i === 0,
      }
      if (i >= 4) cell.numFmt = 'ddd dd mmm'
    })
    if (style) {
      const status = ws.getCell(r, 4)
      status.fill = solid(style.fill)
      status.font = { size: 9, bold: true, color: { argb: style.font } }
    }
    plan.days.forEach((d, i) => {
      const cell = ws.getCell(r, firstDay + i)
      cell.border = { left: thin, right: thin, bottom: thin }
      if (d.weekend) cell.fill = solid(WEEKEND_FILL)
    })
    if (row.cells && style) {
      const { from, to, label } = row.cells
      for (let i = from; i <= to; i++) ws.getCell(r, firstDay + i).fill = solid(style.fill)
      const cell = ws.getCell(r, firstDay + from)
      cell.value = label
      cell.font = { size: 8, bold: true, color: { argb: style.font } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: to === from }
      if (to > from) ws.mergeCells(r, firstDay + from, r, firstDay + to)
    }
    ws.getRow(r).height = 18
    r++
  }

  // --- legend -------------------------------------------------------------------------
  r++
  ws.getCell(r, 1).value = 'Legend'
  ws.getCell(r, 1).font = { bold: true, size: 9, color: { argb: MUTED } }
  LEGEND.forEach((l, i) => {
    const style = CATEGORY_FILL[l.category]!
    const cell = ws.getCell(r, 2 + i)
    cell.value = l.label
    cell.fill = solid(style.fill)
    cell.font = { size: 9, bold: true, color: { argb: style.font } }
    cell.alignment = { horizontal: 'center' }
  })
  r++
  ws.getCell(r, 1).value = 'UP = upgrade of an instance · CL = clone · grey columns = weekend'
  ws.getCell(r, 1).font = { size: 9, color: { argb: MUTED } }
  return ws
}

export function renderOverviewSheet(
  wb: Workbook,
  rows: OverviewRow[],
  exportedOn: string,
): Worksheet {
  const ws = wb.addWorksheet('Overview', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })
  ws.columns = [
    { width: 30 },
    { width: 24 },
    { width: 10 },
    { width: 22 },
    { width: 44 },
    { width: 44 },
    { width: 44 },
    { width: 11 },
    { width: 56 },
  ]
  const t = ws.getCell(1, 1)
  t.value = 'Upgrade overview'
  t.font = { size: 16, bold: true, color: { argb: INK } }
  ws.getRow(1).height = 26
  ws.getCell(2, 1).value =
    `Exported ${formatDay(exportedOn, 'EEE d MMM yyyy')} · ${rows.length} upgrade(s) · one sheet per customer follows`
  ws.getCell(2, 1).font = { size: 10, color: { argb: MUTED } }
  ;[
    'Customer',
    'Upgrade',
    'Cycle',
    'Status',
    'DEV window',
    'UAT window',
    'PROD window',
    'Progress',
    'Next open step',
  ].forEach((h, i) => {
    const c = ws.getCell(3, i + 1)
    c.value = h
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = solid(HEADER_FILL)
    c.alignment = { vertical: 'middle', horizontal: i === 7 ? 'center' : 'left', indent: 1 }
  })
  ws.getRow(3).height = 20
  rows.forEach((row, idx) => {
    const r = 4 + idx
    const values: (string | number)[] = [
      row.customer,
      `${row.from} → ${row.to}`,
      row.cycle,
      row.status,
      row.dev,
      row.uat,
      row.prod,
      row.progress,
      row.nextStep,
    ]
    values.forEach((v, i) => {
      const c = ws.getCell(r, i + 1)
      c.value = v
      c.font = { size: 10, color: { argb: INK }, bold: i === 0 }
      c.border = { bottom: thin }
      c.alignment = {
        vertical: 'middle',
        horizontal: i === 7 ? 'center' : 'left',
        indent: 1,
        wrapText: i >= 4,
      }
    })
    ws.getCell(r, 8).numFmt = '0%'
    const style = CATEGORY_FILL[row.category]
    if (style) {
      const s = ws.getCell(r, 4)
      s.fill = solid(style.fill)
      s.font = { size: 10, bold: true, color: { argb: style.font } }
    }
    ws.getRow(r).height = 30
  })
  return ws
}
