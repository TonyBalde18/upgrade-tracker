import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, CircleDot, LoaderCircle, WifiOff } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { Tooltip } from '@/components/ui/Tooltip'
import { saveNow } from '@/store/saveControl'
import { formatDistanceToNowStrict } from 'date-fns'

export function SyncIndicator() {
  const sync = useTracker((s) => s.sync)
  const pending = useTracker((s) => s.pendingChanges.length)

  let icon = <Check className="h-3.5 w-3.5" />
  let label = 'Saved'
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
      label = 'Not loaded'
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
        className={`relative flex h-8 items-center gap-1.5 overflow-hidden rounded-full border border-border bg-surface-2 px-2.5 text-xs sm:min-w-28 sm:px-3 font-medium cursor-pointer ${tone}`}
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
            <span className="hidden sm:inline">{label}</span>
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  )
}
