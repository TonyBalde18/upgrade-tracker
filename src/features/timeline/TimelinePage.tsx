import { FileSpreadsheet } from 'lucide-react'
import { exportOverviewExcel } from '@/features/excel/exportExcel'
import { animate } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type Modifier,
} from '@dnd-kit/core'
import { Popover } from 'radix-ui'
import { format } from 'date-fns'
import { AlertTriangle, CalendarPlus, CalendarRange, Crosshair, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTracker, undo } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { moveWindow } from '@/store/upgradeActions'
import type { EnvKey, Upgrade } from '@/lib/model/types'
import {
  addDaysIso,
  diffDaysIso,
  formatDay,
  isoWeekOf,
  parseDay,
  todayIn,
  nowIn,
} from '@/lib/dates'
import { dependentTaskIds, prodClashes } from '@/lib/timeline'
import { ENV_LABEL, isActiveUpgrade } from '@/lib/upgrade/logic'
import { useReducedMotion } from '@/theme/motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/components/ui/cn'
import { useElementWidth } from '@/features/plan/gantt'
import { labelWidthFor, ROW_H, TimelineRow, type DragPreview } from './TimelineRow'

type Zoom = '6w' | 'q' | '6m' | 'y'
const ZOOM_DAYS: Record<Zoom, number> = { '6w': 42, q: 91, '6m': 182, y: 365 }
type Scope = 'active' | 'all'
const HEADER_H = 52

const horizontalOnly: Modifier = ({ transform }) => ({ ...transform, y: 0 })

interface PendingMove {
  upgradeId: string
  env: EnvKey
  days: number
}

export default function TimelinePage() {
  const doc = useTracker((s) => s.doc)
  const { settings, customers, upgrades, template } = doc
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const reduced = useReducedMotion()
  const today = todayIn(settings.displayTimeZone)

  const [zoom, setZoom] = useState<Zoom>('q')
  const [scope, setScope] = useState<Scope>('active')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const [pending, setPending] = useState<PendingMove | null>(null)

  const { ref: scrollRef, width: viewW } = useElementWidth<HTMLDivElement>()
  const LABEL_W = labelWidthFor(viewW)
  const trackViewW = Math.max(300, viewW - LABEL_W)
  const targetPx = trackViewW / ZOOM_DAYS[zoom]
  const [px, setPx] = useState(8)
  const anchorDay = useRef<number | null>(null)
  const zoomAnim = useRef<{ stop: () => void } | null>(null)
  const firstLayout = useRef(true)

  // --- rows ----------------------------------------------------------------
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return upgrades
      .filter((u) => scope === 'all' || isActiveUpgrade(u, settings))
      .filter((u) => {
        if (!q) return true
        const c = customerById.get(u.customerId)
        return `${c?.name ?? ''} ${c?.shortName ?? ''} ${u.family} ${u.fromFamily} ${u.cycle}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => {
        const ca = customerById.get(a.customerId)?.name ?? ''
        const cb = customerById.get(b.customerId)?.name ?? ''
        return ca.localeCompare(cb) || a.windows.prod.start.localeCompare(b.windows.prod.start)
      })
  }, [upgrades, scope, query, settings, customerById])

  const range = useMemo(() => {
    const dates = rows
      .flatMap((u) => [
        ...u.tasks.flatMap((t) => [t.start, t.end]),
        u.windows.dev.start.slice(0, 10),
        u.windows.prod.start.slice(0, 10),
      ])
      .filter((d): d is string => !!d)
      .sort()
    const first = [dates[0] ?? today, addDaysIso(today, -42)].sort()[0]!
    const last = [dates[dates.length - 1] ?? today, addDaysIso(today, 182)].sort().reverse()[0]!
    const start = isoWeekOf(addDaysIso(first, -14)).monday
    const end = addDaysIso(isoWeekOf(addDaysIso(last, 28)).monday, 6)
    return { start, days: diffDaysIso(end, start) + 1 }
  }, [rows, today])

  const clashes = useMemo(() => prodClashes(rows, settings), [rows, settings])
  const clashUpgrades = useMemo(
    () => new Set(clashes.nights.flatMap((c) => c.entries.map((e) => e.upgradeId))),
    [clashes],
  )

  // --- zoom with animation, keeping the centre date in place -----------------
  const centreDay = () => {
    const el = scrollRef.current
    return el ? (el.scrollLeft + trackViewW / 2) / px : 0
  }
  useEffect(() => {
    if (!viewW) return
    if (firstLayout.current) {
      firstLayout.current = false
      setPx(targetPx)
      anchorDay.current = diffDaysIso(today, range.start) + ZOOM_DAYS[zoom] * 0.3 // today at ~20% of the view
      return
    }
    anchorDay.current = centreDay()
    zoomAnim.current?.stop()
    if (reduced) {
      setPx(targetPx)
      return
    }
    zoomAnim.current = animate(px, targetPx, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setPx(v),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPx, viewW])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && anchorDay.current != null) el.scrollLeft = anchorDay.current * px - trackViewW / 2
  }, [px, trackViewW, scrollRef])

  // once the animation ends, stop pinning the scroll position
  useEffect(() => {
    if (Math.abs(px - targetPx) < 0.01) anchorDay.current = null
  }, [px, targetPx])

  const scrollToDay = useCallback(
    (iso: string, at = 0.25) => {
      const el = scrollRef.current
      if (!el) return
      anchorDay.current = null
      const left = diffDaysIso(iso, range.start) * px - trackViewW * at
      el.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
    },
    [px, range.start, trackViewW, reduced, scrollRef],
  )

  // --- drag-to-pan with momentum --------------------------------------------
  const panned = useRef(false)
  const suppressClick = useCallback(() => {
    const was = panned.current
    panned.current = false
    return was
  }, [])
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return
    const target = e.target as HTMLElement
    if (target.closest('[data-marker], [data-nopan], input, button, a')) return
    const el = scrollRef.current
    if (!el) return
    anchorDay.current = null
    let lastX = e.clientX
    let lastY = e.clientY
    let lastT = performance.now()
    let vx = 0
    let vy = 0
    let moved = 0
    panned.current = false
    el.style.cursor = 'grabbing'
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      const t = performance.now()
      el.scrollLeft -= dx
      el.scrollTop -= dy
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 5) panned.current = true
      const dt = Math.max(1, t - lastT)
      vx = 0.8 * (dx / dt) + 0.2 * vx
      vy = 0.8 * (dy / dt) + 0.2 * vy
      lastX = ev.clientX
      lastY = ev.clientY
      lastT = t
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.style.cursor = ''
      if (reduced) return
      let fx = vx * 16
      let fy = vy * 16
      const step = () => {
        if (Math.abs(fx) < 0.4 && Math.abs(fy) < 0.4) return
        el.scrollLeft -= fx
        el.scrollTop -= fy
        fx *= 0.93
        fy *= 0.93
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // --- drag a window marker to reschedule ----------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor),
  )
  const onDragMove = (e: DragMoveEvent) => {
    const days = Math.round(e.delta.x / px)
    setPreview((p) =>
      p?.markerId === e.active.id && p.days === days ? p : { markerId: String(e.active.id), days },
    )
  }
  const onDragEnd = (e: DragEndEvent) => {
    const days = Math.round(e.delta.x / px)
    const data = e.active.data.current as { upgradeId: string; env: EnvKey } | undefined
    if (data && days !== 0) setPending({ ...data, days })
    else setPreview(null)
  }
  const pendingUpgrade = pending ? upgrades.find((u) => u.id === pending.upgradeId) : undefined
  const anchors = useMemo(
    () => new Map(template.steps.map((s) => [s.id, s.anchor])),
    [template.steps],
  )

  const confirmMove = (withTasks: boolean) => {
    if (!pending) return
    moveWindow(pending.upgradeId, pending.env, pending.days, withTasks)
    toast.success(
      `${ENV_LABEL[pending.env]} window moved ${pending.days > 0 ? '+' : ''}${pending.days} day(s)`,
      {
        action: { label: 'Undo', onClick: undo },
      },
    )
    setPending(null)
    setPreview(null)
  }

  // --- header data ------------------------------------------------------------
  const weeks = useMemo(() => {
    const out: { monday: string; week: number }[] = []
    for (let i = 0; i < range.days; i += 7) {
      const monday = addDaysIso(range.start, i)
      out.push({ monday, week: isoWeekOf(monday).week })
    }
    return out
  }, [range])
  const months = useMemo(() => {
    const out: { key: string; label: string; from: number; span: number }[] = []
    for (let i = 0; i < range.days; i++) {
      const d = addDaysIso(range.start, i)
      const key = d.slice(0, 7)
      const last = out[out.length - 1]
      if (last && last.key === key) last.span++
      else out.push({ key, label: format(parseDay(d), 'MMMM yyyy'), from: i, span: 1 })
    }
    return out
  }, [range])

  const width = range.days * px
  const weekW = px * 7
  const now = nowIn(settings.displayTimeZone)
  const todayX =
    (diffDaysIso(today, range.start) + (now.getHours() * 60 + now.getMinutes()) / 1440) * px
  const weekClash = new Map(clashes.weeks.map((c) => [c.key, c]))
  const nightClash = clashes.nights

  if (upgrades.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <EmptyState
          icon={<CalendarRange />}
          title="No upgrades yet"
          body="Create the first one and it will appear on the timeline."
          actions={
            <Button variant="primary" onClick={() => setNewUpgradeOpen(true)}>
              New upgrade
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-3 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-2">
          <div className="eyebrow">All customers</div>
          <h1 className="text-2xl font-bold">Global timeline</h1>
        </div>
        <Segmented<Zoom>
          ariaLabel="Zoom"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: '6w', label: '6 weeks' },
            { value: 'q', label: 'Quarter' },
            { value: '6m', label: '6 months' },
            { value: 'y', label: 'Year' },
          ]}
        />
        <Button onClick={() => scrollToDay(today)}>
          <Crosshair className="h-4 w-4" /> Today
        </Button>
        <Button onClick={() => useUi.getState().setIcsTarget({ kind: 'upcoming' })}>
          <CalendarPlus className="h-4 w-4" /> Export upcoming
        </Button>
        <Button onClick={() => void exportOverviewExcel()}>
          <FileSpreadsheet className="h-4 w-4" /> Export to Excel
        </Button>
        <Segmented<Scope>
          ariaLabel="Which upgrades"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="relative w-56">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="pl-9"
            aria-label="Filter upgrades"
          />
        </div>
        <div className="ml-auto">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant={nightClash.length ? 'danger' : 'ghost'}
                disabled={!nightClash.length && !clashes.weeks.length}
              >
                <AlertTriangle className="h-4 w-4" />
                {nightClash.length
                  ? `${nightClash.length} PROD clash${nightClash.length > 1 ? 'es' : ''}`
                  : clashes.weeks.length
                    ? `${clashes.weeks.length} busy PROD week(s)`
                    : 'No PROD clashes'}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="ut-pop z-50 w-96 rounded-xl border border-border bg-surface p-3 shadow-lift"
              >
                <div className="eyebrow mb-2">Same night (two customers on PROD)</div>
                {nightClash.length === 0 && <p className="mb-2 text-sm text-subtle">None.</p>}
                {nightClash.map((c) => (
                  <ClashItem
                    key={c.key}
                    label={`Night of ${formatDay(c.key)}`}
                    entries={c.entries}
                    onClick={() => scrollToDay(c.key, 0.5)}
                    strong
                  />
                ))}
                <div className="eyebrow mt-3 mb-2">Same ISO week</div>
                {clashes.weeks.length === 0 && <p className="text-sm text-subtle">None.</p>}
                {clashes.weeks.map((c) => (
                  <ClashItem
                    key={c.key}
                    label={`Week ${isoWeekOf(c.key).week} (from ${formatDay(c.key, 'EEE d MMM')})`}
                    entries={c.entries}
                    onClick={() => scrollToDay(c.key, 0.5)}
                  />
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        className="relative min-h-0 flex-1 cursor-grab overflow-auto rounded-xl border border-border bg-surface select-none"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="relative" style={{ width: LABEL_W + width, minHeight: '100%' }}>
          {/* header */}
          <div
            className="sticky top-0 z-30 flex border-b border-border bg-surface-2"
            style={{ height: HEADER_H }}
          >
            <div
              className="sticky left-0 z-10 flex shrink-0 items-end border-r border-border bg-surface-2 px-4 pb-2"
              style={{ width: LABEL_W }}
            >
              <span className="eyebrow">
                {rows.length} upgrade{rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="relative" style={{ width }}>
              {months.map((m) => (
                <div
                  key={m.key}
                  className="absolute top-0 flex h-6 items-center overflow-hidden border-l border-border px-2 text-xs font-semibold whitespace-nowrap"
                  style={{ left: m.from * px, width: m.span * px }}
                >
                  {m.span * px > 60 ? m.label : m.span * px > 28 ? m.label.slice(0, 3) : ''}
                </div>
              ))}
              {weeks.map((w, i) => {
                const clash = weekClash.get(w.monday)
                const showNum = weekW >= 26 || i % Math.ceil(26 / weekW) === 0
                return (
                  <div
                    key={w.monday}
                    className={cn(
                      'absolute bottom-0 flex h-6 items-center justify-center border-l border-border text-[0.65rem] tabular',
                      clash
                        ? 'font-bold text-danger'
                        : w.monday === isoWeekOf(today).monday
                          ? 'font-bold text-accent-text'
                          : 'text-subtle',
                    )}
                    style={{ left: i * weekW, width: weekW }}
                    title={`ISO week ${w.week}, from ${formatDay(w.monday)}`}
                  >
                    {showNum ? `${weekW >= 40 ? 'W' : ''}${w.week}` : ''}
                  </div>
                )
              })}
              <div
                className="pointer-events-none absolute bottom-0 z-10 -translate-x-1/2 rounded-sm bg-accent px-1 text-[0.55rem] font-bold tracking-wider text-accent-fg uppercase"
                style={{ left: todayX }}
              >
                Today
              </div>
            </div>
          </div>

          {/* background: week lines, clashes, today */}
          <div
            className="pointer-events-none absolute z-0"
            style={{ left: LABEL_W, top: HEADER_H, width, bottom: 0 }}
            aria-hidden
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--ut-border) 1px, transparent 1px)`,
                backgroundSize: `${weekW}px 100%`,
                opacity: 0.6,
              }}
            />
            {clashes.weeks.map((c) => (
              <div
                key={c.key}
                className="absolute top-0 bottom-0 bg-danger-soft/50"
                style={{ left: diffDaysIso(c.key, range.start) * px, width: weekW }}
              />
            ))}
            {nightClash.map((c) => (
              <div
                key={c.key}
                className="bg-problem-stripes absolute top-0 bottom-0 border-x border-danger/40"
                style={{
                  left: (diffDaysIso(c.key, range.start) + 0.5) * px,
                  width: Math.max(6, px),
                }}
              />
            ))}
            {/* today: a light band over the whole day, and the line at the current time */}
            <div
              className="absolute top-0 bottom-0 bg-accent/[0.07]"
              style={{ left: diffDaysIso(today, range.start) * px, width: Math.max(2, px) }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-[0_0_12px_var(--ut-accent-glow)]"
              style={{ left: todayX - 1 }}
            />
          </div>

          {/* rows */}
          <DndContext
            sensors={sensors}
            modifiers={[horizontalOnly]}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={() => setPreview(null)}
          >
            <div className="relative z-10">
              {rows.map((u, i) => (
                <TimelineRow
                  key={u.id}
                  upgrade={u}
                  customer={customerById.get(u.customerId)}
                  settings={settings}
                  rangeStart={range.start}
                  px={px}
                  width={width}
                  firstOfGroup={i === 0 || rows[i - 1]!.customerId !== u.customerId}
                  clash={clashUpgrades.has(u.id)}
                  preview={preview && preview.markerId.startsWith(`${u.id}:`) ? preview : null}
                  suppressClick={suppressClick}
                  labelW={LABEL_W}
                />
              ))}
              {rows.length === 0 && (
                <div
                  className="sticky left-0 p-8 text-sm text-subtle"
                  style={{ width: Math.min(600, viewW) }}
                >
                  No upgrades match the filter.
                </div>
              )}
            </div>
          </DndContext>
          <div style={{ height: ROW_H }} />
        </div>
      </div>

      <p className="text-xs text-subtle">
        Drag the background to pan, drag a ◆ window to reschedule it. Week numbers are ISO-8601. Red
        stripes: two customers on PROD the same night (noon to noon); red weeks: same ISO week.
      </p>

      <Dialog
        open={!!pending && !!pendingUpgrade}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null)
            setPreview(null)
          }
        }}
        title={pending ? `Move the ${ENV_LABEL[pending.env]} window?` : ''}
        description={
          pending && pendingUpgrade ? (
            <MoveSummary
              upgrade={pendingUpgrade}
              pending={pending}
              customerName={customerById.get(pendingUpgrade.customerId)?.name ?? ''}
            />
          ) : null
        }
        footer={
          pending && pendingUpgrade ? (
            <>
              <Button
                onClick={() => {
                  setPending(null)
                  setPreview(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => confirmMove(false)}>Window only</Button>
              <Button variant="primary" autoFocus onClick={() => confirmMove(true)}>
                Window + {dependentTaskIds(pendingUpgrade, anchors, pending.env).length} dependent
                tasks
              </Button>
            </>
          ) : null
        }
      />
    </div>
  )
}

function ClashItem({
  label,
  entries,
  onClick,
  strong,
}: {
  label: string
  entries: { upgradeId: string; customerId: string; local: string }[]
  onClick: () => void
  strong?: boolean
}) {
  const customers = useTracker((s) => s.doc.customers)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1.5 flex w-full cursor-pointer flex-col gap-1 rounded-lg border p-2 text-left text-sm hover:bg-surface-2',
        strong ? 'border-danger/50' : 'border-border',
      )}
    >
      <span className="font-medium">{label}</span>
      {entries.map((e) => {
        const c = customers.find((x) => x.id === e.customerId)
        return (
          <span key={e.upgradeId} className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: c?.color }} />
            {c?.name ?? 'Unknown'} · {formatDay(e.local.slice(0, 10), 'EEE d MMM')}{' '}
            {e.local.slice(11)}
          </span>
        )
      })}
    </button>
  )
}

function MoveSummary({
  upgrade,
  pending,
  customerName,
}: {
  upgrade: Upgrade
  pending: PendingMove
  customerName: string
}) {
  const settings = useTracker((s) => s.doc.settings)
  const upgrades = useTracker((s) => s.doc.upgrades)
  const w = upgrade.windows[pending.env]!
  const to = addDaysIso(w.start.slice(0, 10), pending.days)
  // would the new PROD date clash with another customer?
  let warn: string | null = null
  if (pending.env === 'prod') {
    const moved = upgrades.map((u) =>
      u.id === upgrade.id
        ? { ...u, windows: { ...u.windows, prod: { ...w, start: `${to}${w.start.slice(10)}` } } }
        : u,
    )
    const c = prodClashes(moved, settings).nights.find((n) =>
      n.entries.some((e) => e.upgradeId === upgrade.id),
    )
    if (c) warn = `Another customer is already on PROD that night (${formatDay(c.key)}).`
  }
  return (
    <span className="flex flex-col gap-2">
      <span>
        {customerName}: {formatDay(w.start.slice(0, 10))} {w.start.slice(11)} →{' '}
        <b className="text-text">
          {formatDay(to)} {w.start.slice(11)}
        </b>{' '}
        ({pending.days > 0 ? '+' : ''}
        {pending.days} day{Math.abs(pending.days) === 1 ? '' : 's'}).
      </span>
      <span>Also shift the tasks scheduled from this window by the same amount?</span>
      {warn && (
        <span className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-4 w-4" /> {warn}
        </span>
      )}
    </span>
  )
}
