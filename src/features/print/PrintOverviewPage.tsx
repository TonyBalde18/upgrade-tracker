import { useMemo } from 'react'
import { useTracker } from '@/store/tracker'
import { useCustomerFilter } from '@/store/ui'
import { addDaysIso, diffDaysIso, formatDay, todayIn } from '@/lib/dates'
import { allWindows, isActiveUpgrade } from '@/lib/upgrade/logic'
import { progressOf, statusCategory } from '@/lib/template/schedule'
import { releaseLogoOf } from '@/lib/releases'
import { windowPosition } from '@/lib/timeline'
import { goNoGoText } from '@/lib/excel/model'
import { tones } from '@/theme/brand'
import { PrintHeader, PrintToolbar } from './PrintPlanPage'

const ENV_COLOR: Record<string, string> = { dev: '#0EA5E9', uat: '#8B5CF6', prod: '#E1292C' }

/**
 * One A4 landscape page with every active upgrade (of the customers chosen in the
 * customer filter): logos, dates of each window, Go / No-Go, progress and a strip
 * of the coming months. For customer and team meetings.
 */
export default function PrintOverviewPage() {
  const doc = useTracker((s) => s.doc)
  const { settings, customers } = doc
  const today = todayIn(settings.displayTimeZone)
  const ids = useMemo(() => customers.map((c) => c.id), [customers])
  const picked = useCustomerFilter(ids)

  const rows = useMemo(
    () =>
      doc.upgrades
        .filter((u) => isActiveUpgrade(u, settings) && (!picked || picked.has(u.customerId)))
        .sort((a, b) => a.windows.prod.start.localeCompare(b.windows.prod.start)),
    [doc.upgrades, settings, picked],
  )
  const single = picked && picked.size === 1 ? customers.find((c) => picked.has(c.id)) : undefined

  // months strip: from this month, at least 6 months, up to the last window
  const lastWindow = rows
    .flatMap((u) => allWindows(u).map((w) => w.window.start.slice(0, 10)))
    .sort()
    .pop()
  const stripStart = `${today.slice(0, 7)}-01`
  const stripEnd = [addDaysIso(stripStart, 182), lastWindow ? addDaysIso(lastWindow, 14) : '']
    .sort()
    .pop()!
  const stripDays = diffDaysIso(stripEnd, stripStart) + 1
  const months: { first: string; days: number }[] = []
  for (let d = stripStart; d <= stripEnd; d = addDaysIso(d, 1)) {
    const last = months[months.length - 1]
    if (last && last.first.slice(0, 7) === d.slice(0, 7)) last.days++
    else months.push({ first: d, days: 1 })
  }
  const pct = (iso: string) => (diffDaysIso(iso, stripStart) / stripDays) * 100
  const todayPct = pct(today)

  return (
    <div className="print-root min-h-full bg-surface-2 p-6 print:bg-white print:p-0">
      <PrintToolbar back="/timeline" backLabel="Back to the timeline" />
      <article className="print-sheet mx-auto max-w-[1120px] bg-white p-8 text-[#0F0100] shadow-lift print:max-w-none print:p-0 print:shadow-none">
        <PrintHeader
          logo={single?.logo}
          title={single ? `${single.name} - upgrade overview` : 'Upgrade overview'}
          subtitle={`${rows.length} active upgrade${rows.length === 1 ? '' : 's'}${
            picked && !single ? ` · ${picked.size} customers` : ''
          } · Printed ${formatDay(today, 'EEE d MMM yyyy')}`}
        />

        {rows.length === 0 ? (
          <p className="text-sm text-[#595959]">No active upgrades for this selection.</p>
        ) : (
          <>
            <table className="w-full table-fixed border-collapse text-[10.5px] leading-snug">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[33%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#262626] text-left text-white">
                  {[
                    'Customer',
                    'Upgrade',
                    'Status',
                    'Windows',
                    'Go / No-Go (PROD)',
                    'Progress',
                  ].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const c = customers.find((x) => x.id === u.customerId)
                  const st = settings.scheduleStatuses.find((s) => s.id === u.scheduleStatus)
                  const tone = tones[st?.tone ?? 'slate']
                  const p = Math.round(progressOf(u.tasks, settings.taskStatuses) * 100)
                  const pending =
                    statusCategory(settings.scheduleStatuses, u.scheduleStatus) === 'planned'
                  return (
                    <tr key={u.id} className="border-b border-[#E5E5E5] break-inside-avoid">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2.5">
                          {c?.logo ? (
                            <img
                              src={c.logo}
                              alt=""
                              className="h-7 w-14 shrink-0 object-contain object-left"
                            />
                          ) : (
                            <span
                              className="h-3 w-3 shrink-0 rounded-sm"
                              style={{ background: c?.color ?? '#999' }}
                            />
                          )}
                          <b className="min-w-0">{c?.name ?? 'Unknown customer'}</b>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          {releaseLogoOf(settings, u.fromFamily) && (
                            <img
                              src={releaseLogoOf(settings, u.fromFamily)}
                              alt=""
                              className="h-5 w-5 rounded"
                            />
                          )}
                          {u.fromFamily} →
                          {releaseLogoOf(settings, u.family) && (
                            <img
                              src={releaseLogoOf(settings, u.family)}
                              alt=""
                              className="h-5 w-5 rounded"
                            />
                          )}
                          <b>{u.family}</b>
                        </div>
                        <div className="text-[9.5px] text-[#595959]">Cycle {u.cycle}</div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 font-semibold"
                          style={{
                            background: pending ? '#FFFFFF' : tone.solid,
                            color: pending ? tone.solid : '#FFFFFF',
                            border: `1px solid ${tone.solid}`,
                          }}
                        >
                          {st?.label ?? '?'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {allWindows(u, c).map((nw) => (
                          <div key={nw.key} className="flex gap-1.5">
                            <b
                              className="w-11 shrink-0"
                              style={{ color: ENV_COLOR[nw.key] ?? '#595959' }}
                            >
                              {nw.label}
                            </b>
                            <span>
                              {formatDay(nw.window.start.slice(0, 10), 'EEE d MMM yyyy')}{' '}
                              {nw.window.start.slice(11)}
                            </span>
                          </div>
                        ))}
                        {!u.windows.uat && (
                          <div className="flex gap-1.5 text-[#8C8C8C]">
                            <b className="w-11 shrink-0">{c?.envNames.uat ?? 'UAT'}</b> not
                            applicable
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">{goNoGoText(u.windows.prod.goNoGo)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDEDED]">
                            <div className="h-full bg-[#00B050]" style={{ width: `${p}%` }} />
                          </div>
                          <span className="w-8 text-right tabular">{p}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* coming months: one line per upgrade with its windows */}
            <section className="mt-6 break-inside-avoid">
              <h2 className="mb-2 text-[13px] font-bold">Windows in the coming months</h2>
              <div className="relative text-[9.5px]">
                <div className="ml-[19%] flex border-b border-[#D9D9D9]">
                  {months.map((m) => (
                    <div
                      key={m.first}
                      className="border-l border-[#D9D9D9] px-1 py-0.5 font-semibold text-[#595959]"
                      style={{ width: `${(m.days / stripDays) * 100}%` }}
                    >
                      {formatDay(m.first, m.days < 20 ? 'MMM' : 'MMM yyyy')}
                    </div>
                  ))}
                </div>
                {rows.map((u) => {
                  const c = customers.find((x) => x.id === u.customerId)
                  return (
                    <div key={u.id} className="flex h-6 items-center border-b border-[#F0F0F0]">
                      <div className="w-[19%] truncate pr-2">{c?.name}</div>
                      <div className="relative h-full flex-1">
                        {todayPct >= 0 && todayPct <= 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-[#E1292C]"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}
                        {allWindows(u, c).map((nw) => {
                          const x = pct(windowPosition(nw.window, settings.displayTimeZone).date)
                          if (x < 0 || x > 100) return null
                          return (
                            <div
                              key={nw.key}
                              className="absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5"
                              style={{ left: `calc(${x}% - 4px)` }}
                            >
                              <span
                                className="block h-2 w-2 rotate-45"
                                style={{ background: ENV_COLOR[nw.key] ?? '#595959' }}
                              />
                              <span className="font-semibold">{nw.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                <p className="mt-1.5 text-[9px] text-[#8C8C8C]">
                  ◆ upgrade window · red line = today · statuses with an outline are not approved
                  yet
                </p>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  )
}
