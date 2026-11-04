import { useState } from 'react'
import type { Upgrade } from '@/lib/model/types'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { NEXT_CYCLE_SHIFT_DAYS, nextCycle } from '@/lib/upgrade/logic'
import { FAMILY_SUGGESTIONS } from '@/lib/model/defaults'

export function RecalcDialog({
  open,
  manual,
  onClose,
  onRun,
}: {
  open: boolean
  manual: number
  onClose: () => void
  onRun: (overwriteManual: boolean) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Recalculate dates from the windows?"
      description={`${manual} task(s) have dates you set by hand. Keep them, or overwrite everything with the template offsets?`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => onRun(true)}>
            Overwrite all
          </Button>
          <Button variant="primary" onClick={() => onRun(false)} autoFocus>
            Keep manual dates
          </Button>
        </>
      }
    />
  )
}

export function ShiftDialog({
  open,
  onClose,
  onRun,
}: {
  open: boolean
  onClose: () => void
  onRun: (days: number, windows: boolean) => void
}) {
  const [days, setDays] = useState(7)
  const [windows, setWindows] = useState(true)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Shift all dates"
      description="Moves every task (and optionally the windows) by the same number of days. Use a negative number to move earlier."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!days} onClick={() => onRun(days, windows)}>
            Shift by {days > 0 ? '+' : ''}
            {days} day(s)
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Days" htmlFor="shift-days">
          <div className="flex items-center gap-2">
            {[-7, -1, 1, 7, 14].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={days === n ? 'outline' : 'secondary'}
                onClick={() => setDays(n)}
              >
                {n > 0 ? '+' : ''}
                {n}
              </Button>
            ))}
            <Input
              id="shift-days"
              type="number"
              value={days}
              onChange={(e) => setDays(Math.trunc(Number(e.target.value)) || 0)}
              className="w-24"
            />
          </div>
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={windows} onCheckedChange={setWindows} label="Also move the windows" />
          Also move the DEV / UAT / PROD windows
        </label>
      </div>
    </Dialog>
  )
}

export function DuplicateDialog({
  open,
  upgrade,
  blockedReason,
  onClose,
  onRun,
}: {
  open: boolean
  upgrade: Upgrade
  blockedReason: string | null
  onClose: () => void
  onRun: (opts: { family: string; cycle: string; shiftDays: number }) => void
}) {
  const [family, setFamily] = useState('')
  const [cycle, setCycle] = useState(nextCycle(upgrade.cycle))
  const [weeks, setWeeks] = useState(NEXT_CYCLE_SHIFT_DAYS / 7)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Duplicate for the next cycle"
      description={`Creates a new upgrade from ${upgrade.family} with windows moved forward and a fresh plan from the template.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!!blockedReason || !family.trim()}
            onClick={() => onRun({ family, cycle, shiftDays: weeks * 7 })}
          >
            Create next upgrade
          </Button>
        </>
      }
    >
      {blockedReason ? (
        <p className="rounded-lg border border-warning/40 bg-surface-2 p-3 text-sm text-muted">
          {blockedReason}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="From release">
            <Input value={upgrade.family} disabled />
          </Field>
          <Field label="To release" htmlFor="dup-family">
            <Input
              id="dup-family"
              list="family-suggestions"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              placeholder="Next family release"
              autoFocus
            />
          </Field>
          <Field label="Cycle" htmlFor="dup-cycle">
            <Input id="dup-cycle" value={cycle} onChange={(e) => setCycle(e.target.value)} />
          </Field>
          <Field
            label="Move windows by (weeks)"
            htmlFor="dup-weeks"
            hint="Whole weeks keep the same weekday."
          >
            <Input
              id="dup-weeks"
              type="number"
              min={1}
              value={weeks}
              onChange={(e) => setWeeks(Math.max(0, Math.trunc(Number(e.target.value))))}
            />
          </Field>
        </div>
      )}
      <datalist id="family-suggestions">
        {FAMILY_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </Dialog>
  )
}
