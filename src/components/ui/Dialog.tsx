import { Dialog as D } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideClose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
  hideClose?: boolean
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  'fixed left-1/2 top-[12vh] z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-border bg-surface p-6 shadow-lift focus:outline-none',
                  className,
                )}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <D.Title className="font-heading text-lg font-semibold">{title}</D.Title>
                    {description ? (
                      <D.Description className="mt-1 text-sm text-muted">
                        {description}
                      </D.Description>
                    ) : (
                      <D.Description className="sr-only">Dialog</D.Description>
                    )}
                  </div>
                  {!hideClose && (
                    <D.Close
                      className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-text cursor-pointer"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </D.Close>
                  )}
                </div>
                {children}
                {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  )
}
