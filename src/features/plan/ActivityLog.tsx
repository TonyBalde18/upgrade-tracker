import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { MessageSquarePlus, Sparkles, StickyNote, Trash2, X } from 'lucide-react'
import type { Upgrade } from '@/lib/model/types'
import { formatInZone } from '@/lib/dates'
import { addNote, deleteLogEntry, updateUpgradeMeta } from '@/store/upgradeActions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

/** Slide-over panel: upgrade notes, free-text log notes and automatic entries. */
export function ActivityLog({
  upgrade,
  open,
  onClose,
  tz,
}: {
  upgrade: Upgrade
  open: boolean
  onClose: () => void
  tz: string
}) {
  const [note, setNote] = useState('')
  const submit = () => {
    addNote(upgrade.id, note)
    setNote('')
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          className="absolute top-0 right-0 bottom-0 z-30 flex w-[min(420px,92vw)] flex-col border-l border-border bg-surface shadow-lift"
          aria-label="Activity log"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <div className="eyebrow">Activity</div>
              <h2 className="font-semibold">Notes & log</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close activity log">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-b border-border p-5">
            <label className="text-xs font-medium text-muted" htmlFor="upgrade-notes">
              Upgrade notes
            </label>
            <Textarea
              id="upgrade-notes"
              key={upgrade.notes}
              defaultValue={upgrade.notes}
              placeholder="Scope, special instructions, contacts…"
              onBlur={(e) =>
                e.target.value !== upgrade.notes &&
                updateUpgradeMeta(upgrade.id, { notes: e.target.value })
              }
              className="min-h-20"
            />
            <label className="text-xs font-medium text-muted" htmlFor="log-note">
              Add a note to the log
            </label>
            <Textarea
              id="log-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
              }}
              placeholder="e.g. Client asked to move PROD by one week (Ctrl+Enter to add)"
              className="min-h-16"
            />
            <Button
              variant="primary"
              size="sm"
              className="self-end"
              onClick={submit}
              disabled={!note.trim()}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
            </Button>
          </div>
          <ol className="flex-1 overflow-y-auto p-5">
            <AnimatePresence initial={false}>
              {upgrade.log.map((e) => (
                <motion.li
                  key={e.at + e.text}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group relative flex gap-3 pb-4 pl-1"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${e.kind === 'note' ? 'bg-accent-soft text-accent-text' : 'bg-surface-3 text-subtle'}`}
                  >
                    {e.kind === 'note' ? (
                      <StickyNote className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.7rem] text-subtle tabular">
                      {formatInZone(new Date(e.at), tz, 'EEE d MMM yyyy HH:mm')}
                    </div>
                    <p
                      className={`text-sm break-words whitespace-pre-wrap ${e.kind === 'note' ? 'text-text' : 'text-muted'}`}
                    >
                      {e.text}
                    </p>
                  </div>
                  {e.kind === 'note' && (
                    <button
                      type="button"
                      onClick={() => deleteLogEntry(upgrade.id, e.at, e.text)}
                      aria-label="Delete note"
                      className="h-6 w-6 shrink-0 cursor-pointer rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
                    >
                      <Trash2 className="mx-auto h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
            {upgrade.log.length === 0 && (
              <li className="text-sm text-subtle">Nothing logged yet.</li>
            )}
          </ol>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
