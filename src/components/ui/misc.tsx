import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-mono text-[0.65rem] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-surface-2',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[ut-shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent',
        className,
      )}
      aria-hidden
    />
  )
}

export function CustomerChip({
  color,
  label,
  className,
}: {
  color: string
  label: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
