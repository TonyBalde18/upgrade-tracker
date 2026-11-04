import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, CircleDot, LoaderCircle, WifiOff } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { Tooltip } from '@/components/ui/Tooltip'
import { useConnection } from './useConnection'
import { saveNow } from '@/store/persistence'
import { formatDistanceToNowStrict } from 'date-fns'

export function SyncIndicator() {
  const sync = useTracker((s) => s.sync)
  const pending = useTracker((s) => s.pendingChanges.length)
  const { mode } = useConnection()

  let icon = <Check className="h-3.5 w-3.5" />
  let label = mode === 'local' ? 'Saved locally' : 'Saved'
  let tone = 'text-success'
  switch (sync.status) {
    case 'unsaved':
      icon = <CircleDot className="h-3.5 w-3.5" />
      label = 'Unsaved'
      tone = 'text-warning'
      break
    case 'saving':
      icon = <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      label = 'Saving…'
      tone = 'text-muted'
      break
    case 'error':
      icon = <AlertTriangle className="h-3.5 w-3.5" />
      label = 'Error'
      tone = 'text-danger'
      break
    case 'offline':
      icon = <WifiOff className="h-3.5 w-3.5" />
      label = 'Offline'
      tone = 'text-warning'
      break
    case 'idle':
      label = mode === 'local' ? 'Local' : 'Not loaded'
      tone = 'text-subtle'
      break
  }

  const detail =
    sync.message ??
    (sync.lastSavedAt
      ? `Last saved ${formatDistanceToNowStrict(new Date(sync.lastSavedAt))} ago${pending ? ` · ${pending} pending change(s)` : ''}`
      : 'Nothing saved yet')

  return (
    <Tooltip
      content={
        <span>
          {detail}
          <br />
          Ctrl+S to save now
        </span>
      }
    >
      <button
        type="button"
        onClick={saveNow}
        className={`relative flex h-8 min-w-28 items-center gap-1.5 overflow-hidden rounded-full border border-border bg-surface-2 px-3 text-xs font-medium cursor-pointer ${tone}`}
        aria-live="polite"
        aria-label={`Sync status: ${label}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={sync.status + label}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="flex items-center gap-1.5"
          >
            {icon}
            {label}
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  )
}
