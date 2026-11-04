import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { RedFlow } from './RedFlow'
import { cn } from './cn'

export function EmptyState({
  icon,
  title,
  body,
  actions,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-pattern-grid relative isolate flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border px-6 py-14 text-center',
        className,
      )}
    >
      <RedFlow className="-z-10 opacity-70" lines={5} intensity={0.8} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="flex max-w-md flex-col items-center gap-3"
      >
        {icon && (
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-surface text-accent-text shadow-card">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-semibold">{title}</h2>
        {body && <div className="text-sm text-muted">{body}</div>}
        {actions && <div className="mt-3 flex flex-wrap justify-center gap-2">{actions}</div>}
      </motion.div>
    </div>
  )
}
