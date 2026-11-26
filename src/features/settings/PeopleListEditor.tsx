import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

/** Editable chips for the Owner / Assignee / Assigned to lists. Renaming updates every task. */
export function PeopleListEditor({
  kind,
  label,
}: {
  kind: 'owners' | 'assignees' | 'people'
  label: string
}) {
  const values = useTracker((s) => s.doc.settings[kind])
  const updateSettings = useTracker((s) => s.updateSettings)
  const renamePerson = useTracker((s) => s.renamePerson)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v || values.includes(v)) return
    updateSettings({ [kind]: [...values, v] }, `Add ${label.toLowerCase()} "${v}"`)
    setDraft('')
  }

  const finishEdit = () => {
    if (editing && editText.trim() && !values.includes(editText.trim()))
      renamePerson(kind, editing, editText)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {values.map((v) => (
            <motion.span
              key={v}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface-2 pl-3 pr-1 text-sm"
            >
              {editing === v ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={finishEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishEdit()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  className="w-32 bg-transparent outline-none"
                  aria-label={`Rename ${v}`}
                />
              ) : (
                <Tooltip content="Click to rename everywhere">
                  <button
                    type="button"
                    className="cursor-text"
                    onClick={() => {
                      setEditing(v)
                      setEditText(v)
                    }}
                  >
                    {v}
                  </button>
                </Tooltip>
              )}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() =>
                  updateSettings(
                    { [kind]: values.filter((x) => x !== v) },
                    `Remove ${label.toLowerCase()} "${v}"`,
                  )
                }
                className="rounded-full p-1 text-subtle hover:bg-surface-3 hover:text-text cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex max-w-sm gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={`Add ${label.toLowerCase()}…`}
          aria-label={`New ${label.toLowerCase()}`}
        />
        <Button onClick={add} disabled={!draft.trim()} aria-label={`Add ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-subtle">
        Removing a name keeps it on existing tasks; it just disappears from the pick lists.
      </p>
    </div>
  )
}
