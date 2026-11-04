import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
  delay,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}) {
  if (content == null || content === '') return <>{children}</>
  return (
    <T.Root delayDuration={delay}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="ut-pop z-50 max-w-xs rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs text-text shadow-lift"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
