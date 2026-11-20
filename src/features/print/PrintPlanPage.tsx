import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { formatDay, todayIn } from '@/lib/dates'
import { CATEGORY_FILL, LEGEND, planModel } from '@/lib/excel/model'
import { Button } from '@/components/ui/Button'

const hex = (argb: string) => `#${argb.slice(2)}`

/**
 * A clean A4 landscape page of one upgrade, for meetings or "Save as PDF".
 * Same content and colours as the Excel export. Always light, whatever the app theme.
 */
export default function PrintPlanPage() {
  const { upgradeId } = useParams()
  const doc = useTracker((s) => s.doc)
  const upgrade = doc.upgrades.find((u) => u.id === upgradeId)
  const today = todayIn(doc.settings.displayTimeZone)
  const plan = useMemo(
    () => (upgrade ? planModel(doc, upgrade, today) : null),
    [doc, upgrade, today],
  )

  if (!upgrade || !plan) {
    return <div className="p-8 text-muted">Upgrade not found.</div>
  }

  // header band: one cell per month, spanning its days
  const months: { first: string; days: number }[] = []
  for (const d of plan.days) {
    const last = months[months.length - 1]
    if (last && last.first.slice(0, 7) === d.date.slice(0, 7)) last.days++
    else months.push({ first: d.date, days: 1 })
  }

  return (
    <div className="print-root min-h-full bg-surface-2 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[1120px] items-center gap-2 print:hidden">
        <Link to={`/upgrades/${upgrade.id}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4" /> Back to the plan
          </Button>
        </Link>
        <span className="ml-auto text-sm text-muted">
          A4 landscape. Choose “Save as PDF” as printer to get a PDF.
        </span>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <article className="print-sheet mx-auto max-w-[1120px] bg-white p-8 text-[#0F0100] shadow-lift print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-4 flex items-start gap-4">
          {plan.customer.logo && (
            <img src={plan.customer.logo} alt="" className="h-12 w-auto max-w-32 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{plan.title}</h1>
            <p className="text-xs text-[#595959]">
              {plan.subtitle} · Printed {formatDay(today, 'EEE d MMM yyyy')}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {plan.fromLogo && (
              <img
                src={plan.fromLogo}
                alt={plan.fromFamily}
                className="h-11 w-11 rounded-lg object-cover"
              />
            )}
            {plan.toLogo && (
              <img
                src={plan.toLogo}
                alt={plan.family}
                className="h-11 w-11 rounded-lg object-cover"
              />
            )}
          </div>
        </header>

        <dl className="mb-4 grid grid-cols-3 gap-2 text-[11px]">
          {plan.windows.map((w) => (
            <div key={w.env} className="rounded-md border border-[#D9D9D9] px-2 py-1.5">
              <dt className="font-bold text-[#E1292C]">{w.env} window</dt>
              <dd>{w.text}</dd>
            </div>
          ))}
        </dl>

        <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[5.5%]" />
            <col className="w-[5.5%]" />
            {plan.days.map((d) => (
              <col key={d.date} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-[#262626] text-white">
              <th colSpan={6} className="px-1 py-0.5 text-left font-semibold">
                Step
              </th>
              {months.map((m) => (
                <th
                  key={m.first}
                  colSpan={m.days}
                  className="border-l border-[#595959] py-0.5 font-semibold"
                >
                  {formatDay(m.first, 'MMM yyyy')}
                </th>
              ))}
            </tr>
            <tr className="bg-[#262626] text-white">
              {['Step', 'Owner', 'Assignee', 'Status', 'Start', 'End'].map((h, i) => (
                <th key={h} className={`px-1 py-0.5 font-semibold ${i === 0 ? 'text-left' : ''}`}>
                  {h}
                </th>
              ))}
              {plan.days.map((d) => (
                <th
                  key={d.date}
                  className="py-0.5 text-center font-normal"
                  style={{ background: d.today ? '#E1292C' : d.weekend ? '#7F7F7F' : undefined }}
                >
                  {Number(d.date.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row, ri) =>
              row.kind === 'phase' ? (
                <tr key={`p-${row.phase}`} className="bg-[#F2F2F2]">
                  <td
                    colSpan={6 + plan.days.length}
                    className="px-1 py-0.5 font-bold text-[#E1292C] uppercase"
                  >
                    {row.phase}
                  </td>
                </tr>
              ) : (
                <tr key={`t-${ri}`} className="border-b border-[#E5E5E5] break-inside-avoid">
                  <td className="px-1 py-0.5">{row.name}</td>
                  <td className="px-1 text-center">{row.owner}</td>
                  <td className="px-1 text-center">{row.assignee}</td>
                  <td
                    className="px-1 text-center font-semibold"
                    style={
                      CATEGORY_FILL[row.category]
                        ? {
                            background: hex(CATEGORY_FILL[row.category]!.fill),
                            color: hex(CATEGORY_FILL[row.category]!.font),
                          }
                        : undefined
                    }
                  >
                    {row.status}
                  </td>
                  <td className="px-1 text-center">{formatDay(row.start, 'd MMM')}</td>
                  <td className="px-1 text-center">{formatDay(row.end, 'd MMM')}</td>
                  {plan.days.map((d, i) => {
                    const c = row.cells
                    if (c && i > c.from && i <= c.to) return null
                    if (c && i === c.from) {
                      const style = CATEGORY_FILL[c.category]
                      return (
                        <td
                          key={d.date}
                          colSpan={c.to - c.from + 1}
                          className="overflow-hidden text-center font-bold whitespace-nowrap"
                          style={
                            style
                              ? { background: hex(style.fill), color: hex(style.font) }
                              : undefined
                          }
                        >
                          {c.label}
                        </td>
                      )
                    }
                    return (
                      <td
                        key={d.date}
                        className="border-x border-[#F0F0F0]"
                        style={d.weekend ? { background: '#EDEDED' } : undefined}
                      />
                    )
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>

        <footer className="mt-3 flex flex-wrap items-center gap-2 text-[9px] text-[#595959]">
          {LEGEND.map((l) => (
            <Fragment key={l.category}>
              <span
                className="rounded px-1.5 py-0.5 font-semibold"
                style={{
                  background: hex(CATEGORY_FILL[l.category]!.fill),
                  color: hex(CATEGORY_FILL[l.category]!.font),
                }}
              >
                {l.label}
              </span>
            </Fragment>
          ))}
          <span className="ml-2">
            UP = upgrade of an instance · CL = clone · grey = weekend · red day = today
          </span>
        </footer>
      </article>
    </div>
  )
}
