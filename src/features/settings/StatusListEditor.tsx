import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Popover } from 'radix-ui'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTracker } from '@/store/tracker'
import type { StatusCategory, StatusDef, StatusListKey, TrackerDoc } from '@/lib/model/types'
import { ALLOWED_CATEGORIES, REQUIRED_CATEGORIES } from '@/lib/model/defaults'
import { toneNames, type Tone } from '@/theme/brand'
import { CATEGORY_LABEL, CategoryIcon, StatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'

function usageCount(doc: TrackerDoc, list: StatusListKey, id: string): number {
  let n = 0
  for (const u of doc.upgrades) {
    if (list === 'scheduleStatuses' && u.scheduleStatus === id) n++
    if (list === 'windowStatuses')
      for (const w of [u.windows.dev, u.windows.uat, u.windows.prod]) if (w?.status === id) n++
    if (list === 'taskStatuses') for (const t of u.tasks) if (t.status === id) n++
  }
  return n
}

function TonePicker({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border-strong"
        style={{ backgroundColor: `var(--tone-${value}-solid)` }}
        aria-label={`Colour: ${value}`}
      />
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="ut-pop z-50 grid grid-cols-6 gap-1.5 rounded-xl border border-border bg-surface p-2 shadow-lift"
        >
          {toneNames.map((t) => (
            <Popover.Close key={t} asChild>
              <button
                type="button"
                onClick={() => onChange(t)}
                aria-label={t}
                title={t === 'red' ? 'red (reserved for problems)' : t}
                className={cn(
                  'h-7 w-7 cursor-pointer rounded-md border transition-transform hover:scale-110',
                  t === value ? 'border-text' : 'border-transparent',
                )}
                style={{ backgroundColor: `var(--tone-${t}-solid)` }}
              />
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function StatusListEditor({
  list,
  title,
  description,
}: {
  list: StatusListKey
  title: string
  description: string
}) {
  const statuses = useTracker((s) => s.doc.settings[list])
  const { addStatus, updateStatus, deleteStatus, moveStatus } = useTracker.getState()
  const [toDelete, setToDelete] = useState<StatusDef | null>(null)
  const [replacement, setReplacement] = useState('')

  const allowed = ALLOWED_CATEGORIES[list] as readonly StatusCategory[]
  const required = REQUIRED_CATEGORIES[list] as readonly StatusCategory[]

  const canDelete = (s: StatusDef) =>
    !required.includes(s.category) || statuses.filter((x) => x.category === s.category).length > 1

  const startDelete = (s: StatusDef) => {
    if (!canDelete(s)) {
      toast.error(`Keep at least one "${CATEGORY_LABEL[s.category]}" status`, {
        description: 'The app relies on it (for example to compute progress).',
      })
      return
    }
    const used = usageCount(useTracker.getState().doc, list, s.id)
    if (used === 0) {
      deleteStatus(list, s.id, s.id)
      return
    }
    const sameCat = statuses.find((x) => x.id !== s.id && x.category === s.category)
    setReplacement((sameCat ?? statuses.find((x) => x.id !== s.id))?.id ?? '')
    setToDelete(s)
  }

  const add = () => {
    addStatus(list, { label: 'New status', tone: 'slate', category: allowed[0] ?? 'planned' })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-subtle">{description}</p>
        </div>
        <Button size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add status
        </Button>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
          {statuses.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="flex items-center gap-3 overflow-hidden px-3 py-2"
            >
              <TonePicker value={s.tone} onChange={(tone) => updateStatus(list, s.id, { tone })} />
              <Input
                key={s.label}
                defaultValue={s.label}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== s.label) updateStatus(list, s.id, { label: v })
                  else e.target.value = s.label
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="h-8 max-w-64"
                aria-label="Status name"
              />
              <div className="w-56">
                <Select
                  size="sm"
                  ariaLabel="Category"
                  value={s.category}
                  onChange={(v) => {
                    if (!canDelete(s)) {
                      toast.error(`Keep at least one "${CATEGORY_LABEL[s.category]}" status`)
                      return
                    }
                    updateStatus(list, s.id, { category: v as StatusCategory })
                  }}
                  options={allowed.map((c) => ({
                    value: c,
                    label: CATEGORY_LABEL[c],
                    icon: <CategoryIcon category={c} className="text-subtle" />,
                  }))}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <StatusBadge status={s} size="sm" />
                <Tooltip content="Move up">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => moveStatus(list, s.id, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Move down">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === statuses.length - 1}
                    onClick={() => moveStatus(list, s.id, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={
                    canDelete(s) ? 'Delete' : 'Required: at least one status of this category'
                  }
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startDelete(s)}
                    aria-label={`Delete ${s.label}`}
                    className={cn(!canDelete(s) && 'opacity-40')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog
        open={toDelete != null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.label ?? ''}"?`}
        description={
          toDelete
            ? `It is used ${usageCount(useTracker.getState().doc, list, toDelete.id)} time(s). Choose the status those items should get instead.`
            : ''
        }
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!replacement}
              onClick={() => {
                if (toDelete) deleteStatus(list, toDelete.id, replacement)
                setToDelete(null)
              }}
            >
              Delete and reassign
            </Button>
          </>
        }
      >
        <Select
          value={replacement}
          onChange={setReplacement}
          ariaLabel="Replacement status"
          options={statuses
            .filter((x) => x.id !== toDelete?.id)
            .map((x) => ({
              value: x.id,
              label: x.label,
              icon: <CategoryIcon category={x.category} />,
            }))}
        />
      </Dialog>
    </div>
  )
}
