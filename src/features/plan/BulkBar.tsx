import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { CalendarClock, CheckSquare, X } from 'lucide-react'
import type { Settings } from '@/lib/model/types'
import { bulkUpdateTasks, type BulkPatch } from '@/store/upgradeActions'
import { undo } from '@/store/tracker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const NONE = '__none__'
const PICK = '__pick__'

/** Change several selected steps at once: status, owner, assignee, assigned to, dates. */
export function BulkBar({
  upgradeId,
  settings,
  ids,
  total,
  onClear,
  onSelectAll,
}: {
  upgradeId: string
  settings: Settings
  ids: string[]
  total: number
  onClear: () => void
  onSelectAll: () => void
}) {
  const [days, setDays] = useState('')

  const apply = (patch: BulkPatch, what: string) => {
    const n = bulkUpdateTasks(upgradeId, ids, patch)
    toast(`${n} step${n === 1 ? '' : 's'}: ${what}`, { action: { label: 'Undo', onClick: undo } })
  }

  const pick = (
    label: string,
    values: string[] | { value: string; label: string }[],
    onPick: (v: string) => void,
    withNobody = false,
  ) => {
    const options = values.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
    return (
      <div className="w-36">
        <Select
          size="sm"
          ariaLabel={`Set ${label} of the selected steps`}
          value={PICK}
          onChange={(v) => v !== PICK && onPick(v === NONE ? '' : v)}
          options={[
            { value: PICK, label },
            ...(withNobody ? [{ value: NONE, label: 'Nobody' }] : []),
            ...options,
          ]}
        />
      </div>
    )
  }

  const n = Number(days)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2"
      role="toolbar"
      aria-label="Change the selected steps"
    >
      <span className="text-sm font-semibold tabular">{ids.length} selected</span>
      {ids.length < total && (
        <Button size="sm" variant="ghost" onClick={onSelectAll}>
          <CheckSquare className="h-3.5 w-3.5" /> All {total}
        </Button>
      )}
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
      {pick(
        'Status…',
        settings.taskStatuses.map((s) => ({ value: s.id, label: s.label })),
        (v) =>
          apply(
            { status: v },
            `status ${settings.taskStatuses.find((s) => s.id === v)?.label ?? v}`,
          ),
      )}
      {pick(
        'Assigned to…',
        settings.people,
        (v) => apply({ assignedTo: v }, `assigned to ${v || 'nobody'}`),
        true,
      )}
      {pick('Owner…', settings.owners, (v) => apply({ owner: v }, `owner ${v}`))}
      {pick('Assignee…', settings.assignees, (v) => apply({ assignee: v }, `assignee ${v}`))}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!Number.isInteger(n) || n === 0) return
          apply({ shiftDays: n }, `dates moved ${n > 0 ? '+' : ''}${n} day(s)`)
          setDays('')
        }}
      >
        <Input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="± days"
          aria-label="Move the dates of the selected steps by this many days"
          className="h-8 w-20 text-xs"
        />
        <Button size="sm" type="submit" disabled={!Number.isInteger(n) || n === 0}>
          <CalendarClock className="h-3.5 w-3.5" /> Move dates
        </Button>
      </form>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
    </motion.div>
  )
}
