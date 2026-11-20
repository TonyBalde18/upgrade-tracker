// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildDemoDoc } from '@/demo/demo-data'
import { planModel } from './model'
import { renderPlanSheet } from './render'

describe('exceljs browser build (the one the site loads)', () => {
  it('creates a workbook in a browser-like environment', async () => {
    const mod = (await import('exceljs/dist/exceljs.bare.min.js')) as unknown as {
      default?: typeof import('exceljs')
    } & typeof import('exceljs')
    const ExcelJS = mod.default ?? mod
    const wb = new ExcelJS.Workbook()
    const doc = buildDemoDoc()
    const u = doc.upgrades[0]!
    renderPlanSheet(wb, planModel(doc, u, u.windows.dev.start.slice(0, 10)))
    const buffer = await wb.xlsx.writeBuffer()
    // an .xlsx file is a zip: it starts with "PK"
    expect(new Uint8Array(buffer as ArrayBuffer).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]))
  })
})
