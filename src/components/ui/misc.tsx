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
  logo,
  className,
}: {
  color: string
  label: string
  logo?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      {logo ? (
        <img
          src={logo}
          alt=""
          className="h-4 w-4 shrink-0 rounded-[3px] bg-white object-contain p-px"
          draggable={false}
        />
      ) : (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Logo on a white tile (logos are designed for white), or coloured initials. */
export function CustomerAvatar({
  name,
  shortName,
  color,
  logo,
  size = 40,
  className,
}: {
  name: string
  shortName?: string
  color: string
  logo?: string
  size?: number
  className?: string
}) {
  const initials = (shortName || name).slice(0, 3).toUpperCase()
  return logo ? (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-black/5',
        className,
      )}
      style={{ width: size, height: size, padding: Math.round(size * 0.1) }}
    >
      <img
        src={logo}
        alt={`${name} logo`}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  ) : (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl font-heading font-bold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(10, Math.round(size * 0.3)),
      }}
      aria-hidden
    >
      {initials}
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
