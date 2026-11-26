/**
 * "Export to Excel": one upgrade, or an overview of all active upgrades with one
 * sheet per customer. The Excel library (~250 KB compressed) is only downloaded
 * the first time you export.
 */
import { toast } from 'sonner'
import type { Workbook } from 'exceljs'
import { useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { todayIn } from '@/lib/dates'
import { isActiveUpgrade } from '@/lib/upgrade/logic'
import { overviewRows, planModel, safeFileName, type PlanModel } from '@/lib/excel/model'
import { renderOverviewSheet, renderPlanSheet, type PlanImages } from '@/lib/excel/render'

type ExcelModule = typeof import('exceljs')

async function loadExcel(): Promise<ExcelModule> {
  // the "bare" browser build: no polyfills that would need eval (blocked by our CSP)
  const mod = (await import('exceljs/dist/exceljs.bare.min.js')) as unknown as {
    default?: ExcelModule
  } & ExcelModule
  return mod.default ?? mod
}

/** Excel only takes PNG / JPEG: redraw WebP logos as PNG. */
async function toPng(dataUrl: string | undefined): Promise<string | undefined> {
  if (!dataUrl) return undefined
  if (/^data:image\/(png|jpeg);/.test(dataUrl)) return dataUrl
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image'))
      img.src = dataUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')?.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

async function imagesFor(plan: PlanModel): Promise<PlanImages> {
  const [customer, from, to] = await Promise.all([
    toPng(plan.customer.logo),
    toPng(plan.fromLogo),
    toPng(plan.toLogo),
  ])
  return { customer, from, to }
}

async function download(wb: Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Upgrade Tracker'
  wb.created = new Date()
  return wb
}

async function run(what: string, fn: () => Promise<string | null>) {
  const id = toast.loading(`Preparing ${what}…`)
  try {
    const name = await fn()
    if (name) toast.success('Excel file downloaded', { id, description: name })
    else toast.dismiss(id)
  } catch (e) {
    toast.error('Excel export failed', {
      id,
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

/** One upgrade, in the layout of the customer schedules. */
export function exportUpgradeExcel(upgradeId: string): Promise<void> {
  return run('the Excel file', async () => {
    const { doc } = useTracker.getState()
    const upgrade = doc.upgrades.find((u) => u.id === upgradeId)
    if (!upgrade) throw new Error('Upgrade not found')
    const plan = planModel(doc, upgrade, todayIn(doc.settings.displayTimeZone))
    const wb = await newWorkbook()
    renderPlanSheet(wb, plan, await imagesFor(plan))
    await download(wb, plan.fileName)
    return plan.fileName
  })
}

/**
 * All active upgrades (of the customers chosen in the customer filter, if any): an
 * overview sheet, then one sheet per upgrade.
 */
export function exportOverviewExcel(): Promise<void> {
  return run('the overview', async () => {
    const { doc } = useTracker.getState()
    const picked = new Set(
      useUi.getState().customerFilter.filter((id) => doc.customers.some((c) => c.id === id)),
    )
    const upgrades = doc.upgrades.filter(
      (u) => isActiveUpgrade(u, doc.settings) && (picked.size === 0 || picked.has(u.customerId)),
    )
    if (upgrades.length === 0) {
      toast('No active upgrades to export')
      return null
    }
    const today = todayIn(doc.settings.displayTimeZone)
    const wb = await newWorkbook()
    const rows = overviewRows(doc, upgrades)
    renderOverviewSheet(wb, rows, today)
    const taken = new Set(['overview'])
    const ordered = [...upgrades].sort((a, b) =>
      a.windows.prod.start.localeCompare(b.windows.prod.start),
    )
    for (const u of ordered) {
      const plan = planModel(doc, u, today, taken)
      renderPlanSheet(wb, plan, await imagesFor(plan))
    }
    const name = safeFileName(`Upgrade overview ${today}.xlsx`)
    await download(wb, name)
    return name
  })
}
