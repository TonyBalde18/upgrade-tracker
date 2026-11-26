import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { formatDay, isoWeekOf, todayIn } from '@/lib/dates'
import { CATEGORY_FILL, LEGEND, planModel, type PlanModel } from '@/lib/excel/model'
import { fitLabel } from '@/lib/excel/render'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

const hex = (argb: string) => `#${argb.slice(2)}`

/** More days than this and the calendar uses one column per week, so it stays readable. */
const MAX_DAY_COLUMNS = 49

interface CalCol {
  key: string
  /** first day index in plan.days */
  from: number
  to: number
  label: string
  month: string
  weekend: boolean
  today: boolean
}

function calendarColumns(plan: PlanModel): { cols: CalCol[]; weekly: boolean } {
  const weekly = plan.days.length > MAX_DAY_COLUMNS
  if (!weekly)
    return {
      weekly,
      cols: plan.days.map((d, i) => ({
        key: d.date,
        from: i,
        to: i,
        label: String(Number(d.date.slice(8))),
        month: d.date.slice(0, 7),
        weekend: d.weekend,
        today: d.today,
      })),
    }
  const cols: CalCol[] = []
  for (let i = 0; i < plan.days.length; i += 7) {
    const week = plan.days.slice(i, i + 7)
    cols.push({
      key: week[0]!.date,
      from: i,
      to: i + week.length - 1,
      label: `W${isoWeekOf(week[0]!.date).week}`,
      month: week[0]!.date.slice(0, 7),
      weekend: false,
      today: week.some((d) => d.today),
    })
  }
  return { weekly, cols }
}

/** Header for printed pages: logo, title, subtitle, release badges. Plenty of room around the logo. */
export function PrintHeader({
  logo,
  title,
  subtitle,
  badges = [],
}: {
  logo?: string
  title: string
  subtitle: string
  badges?: { src?: string; alt: string }[]
}) {
  return (
    <header className="mb-5 flex items-center gap-6 border-b-2 border-[#E1292C] pb-4">
      {logo && <img src={logo} alt="" className="h-14 w-auto max-w-40 shrink-0 object-contain" />}
      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] leading-tight font-bold">{title}</h1>
        <p className="mt-1 text-[12px] text-[#595959]">{subtitle}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {badges
          .filter((b) => b.src)
          .map((b) => (
            <img
              key={b.alt}
              src={b.src}
              alt={b.alt}
              title={b.alt}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ))}
      </div>
    </header>
  )
}

export function PrintToolbar({ back, backLabel }: { back: string; backLabel: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[1120px] flex-wrap items-center gap-2 print:hidden">
      <Link to={back}>
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Button>
      </Link>
      <span className="ml-auto text-sm text-muted">
        A4 landscape. Choose “Save as PDF” as printer to get a PDF.
      </span>
      <Button variant="primary" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
    </div>
  )
}

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

  const { cols, weekly } = calendarColumns(plan)
  // header band: one cell per month, spanning its columns
  const months: { month: string; span: number }[] = []
  for (const c of cols) {
    const last = months[months.length - 1]
    if (last && last.month === c.month) last.span++
    else months.push({ month: c.month, span: 1 })
  }
  const colOf = (dayIndex: number) => cols.findIndex((c) => dayIndex >= c.from && dayIndex <= c.to)

  return (
    <div className="print-root min-h-full bg-surface-2 p-6 print:bg-white print:p-0">
      <PrintToolbar back={`/upgrades/${upgrade.id}`} backLabel="Back to the plan" />

      <article className="print-sheet mx-auto max-w-[1120px] bg-white p-8 text-[#0F0100] shadow-lift print:max-w-none print:p-0 print:shadow-none">
        <PrintHeader
          logo={plan.customer.logo}
          title={plan.title}
          subtitle={`${plan.subtitle} · Printed ${formatDay(today, 'EEE d MMM yyyy')}`}
          badges={[
            { src: plan.fromLogo, alt: plan.fromFamily },
            { src: plan.toLogo, alt: plan.family },
          ]}
        />

        <dl
          className="mb-5 grid gap-2 text-[11px]"
          style={{
            gridTemplateColumns: `repeat(${Math.min(4, plan.windows.length)}, minmax(0, 1fr))`,
          }}
        >
          {plan.windows.map((w) => (
            <div key={w.env} className="rounded-md border border-[#D9D9D9] px-2.5 py-2">
              <dt className="font-bold text-[#E1292C]">{w.env} window</dt>
              <dd className="mt-0.5">{w.text}</dd>
              {w.goNoGo && (
                <dd
                  className={cn(
                    'mt-0.5 font-semibold',
                    w.goNoGo.startsWith('Go')
                      ? 'text-[#00B050]'
                      : w.goNoGo.startsWith('No-Go')
                        ? 'text-[#E1292C]'
                        : 'text-[#595959]',
                  )}
                >
                  Go / No-Go: {w.goNoGo}
                </dd>
              )}
            </div>
          ))}
        </dl>

        <table className="w-full table-fixed border-collapse text-[10px] leading-snug">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[6.5%]" />
            <col className="w-[6.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            {cols.map((c) => (
              <col key={c.key} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-[#262626] text-white">
              <th colSpan={7} className="px-1.5 py-1 text-left font-normal text-[#BFBFBF]">
                {weekly ? 'One column per week (W = ISO week)' : 'One column per day'}
              </th>
              {months.map((m) => (
                <th
                  key={m.month}
                  colSpan={m.span}
                  className="border-l border-[#595959] py-1 font-semibold"
                >
                  {formatDay(`${m.month}-01`, m.span < 3 ? 'MMM' : 'MMM yyyy')}
                </th>
              ))}
            </tr>
            <tr className="bg-[#262626] text-white">
              {['Step', 'Assigned to', 'Owner', 'Assignee', 'Status', 'Start', 'End'].map(
                (h, i) => (
                  <th key={h} className={`px-1.5 py-1 font-semibold ${i === 0 ? 'text-left' : ''}`}>
                    {h}
                  </th>
                ),
              )}
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="py-1 text-center text-[8px] font-normal"
                  style={{ background: c.today ? '#E1292C' : c.weekend ? '#7F7F7F' : undefined }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row, ri) =>
              row.kind === 'phase' ? (
                <tr key={`p-${row.phase}`} className="bg-[#F2F2F2] break-after-avoid">
                  <td
                    colSpan={7 + cols.length}
                    className="px-1.5 py-1 font-bold text-[#E1292C] uppercase"
                  >
                    {row.label}
                  </td>
                </tr>
              ) : (
                <tr key={`t-${ri}`} className="border-b border-[#E5E5E5] break-inside-avoid">
                  <td className="px-1.5 py-1">{row.name}</td>
                  <td className="px-1 text-center">{row.assignedTo}</td>
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
                  <td className="px-1 text-center whitespace-nowrap">
                    {formatDay(row.start, 'd MMM')}
                  </td>
                  <td className="px-1 text-center whitespace-nowrap">
                    {formatDay(row.end, 'd MMM')}
                  </td>
                  {(() => {
                    const c = row.cells
                    const from = c ? colOf(c.from) : -1
                    const to = c ? colOf(c.to) : -1
                    return cols.map((col, i) => {
                      if (c && i > from && i <= to) return null
                      if (c && i === from) {
                        const style = CATEGORY_FILL[c.category]
                        const span = to - from + 1
                        return (
                          <td
                            key={col.key}
                            colSpan={span}
                            title={c.label}
                            className="overflow-hidden text-center text-[8.5px] font-bold whitespace-nowrap"
                            style={
                              style
                                ? { background: hex(style.fill), color: hex(style.font) }
                                : undefined
                            }
                          >
                            {fitLabel(c.label, weekly ? span * 3 : span)}
                          </td>
                        )
                      }
                      return (
                        <td
                          key={col.key}
                          className="border-x border-[#F0F0F0]"
                          style={col.weekend ? { background: '#EDEDED' } : undefined}
                        />
                      )
                    })
                  })()}
                </tr>
              ),
            )}
          </tbody>
        </table>

        <footer className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-[#595959]">
          {LEGEND.map((l) => (
            <span
              key={l.category}
              className="rounded px-1.5 py-0.5 font-semibold"
              style={{
                background: hex(CATEGORY_FILL[l.category]!.fill),
                color: hex(CATEGORY_FILL[l.category]!.font),
              }}
            >
              {l.label}
            </span>
          ))}
          <span className="ml-2">
            UP = upgrade of an instance · CL = clone ·{' '}
            {weekly ? 'red week = this week' : 'grey = weekend · red day = today'}
          </span>
        </footer>
      </article>
    </div>
  )
}
