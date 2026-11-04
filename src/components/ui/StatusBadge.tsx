import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleMinus,
  CircleSlash,
  OctagonAlert,
  CalendarCheck,
} from 'lucide-react'
import type { StatusCategory, StatusDef } from '@/lib/model/types'
import type { Tone } from '@/theme/brand'
import { cn } from './cn'

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  planned: 'Planned / not started',
  confirmed: 'Confirmed',
  active: 'In progress',
  done: 'Done',
  blocked: 'Blocked (problem)',
  cancelled: 'Cancelled',
  na: 'Not applicable',
}

export function CategoryIcon({
  category,
  className,
}: {
  category: StatusCategory
  className?: string
}) {
  const c = cn('h-3.5 w-3.5 shrink-0', className)
  switch (category) {
    case 'planned':
      return <CircleDashed className={c} aria-hidden />
    case 'confirmed':
      return <CalendarCheck className={c} aria-hidden />
    case 'active':
      return <CircleDot className={c} aria-hidden />
    case 'done':
      return <CircleCheck className={c} aria-hidden />
    case 'blocked':
      return <OctagonAlert className={c} aria-hidden />
    case 'cancelled':
      return <Ban className={c} aria-hidden />
    case 'na':
      return <CircleMinus className={c} aria-hidden />
    default:
      return <CircleSlash className={c} aria-hidden />
  }
}

export function toneStyle(tone: Tone): React.CSSProperties {
  return { color: `var(--tone-${tone}-fg)`, backgroundColor: `var(--tone-${tone}-bg)` }
}

/**
 * Status pill: always icon + text, never colour alone.
 * "active" gets a red pulsing dot (brand: now / flow); "blocked" gets stripes
 * and an alert icon, so the two can never be confused.
 */
export function StatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: StatusDef | undefined
  className?: string
  size?: 'sm' | 'md'
}) {
  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-subtle',
          className,
        )}
      >
        Unknown
      </span>
    )
  }
  const active = status.category === 'active'
  const blocked = status.category === 'blocked'
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[0.7rem]' : 'px-2.5 py-0.5 text-xs',
        blocked && 'bg-problem-stripes ring-1 ring-danger/50',
        active && 'ring-1 ring-accent/50',
        className,
      )}
      style={toneStyle(status.tone)}
    >
      {active ? (
        <span
          className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent text-accent"
          aria-hidden
        />
      ) : (
        <CategoryIcon category={status.category} />
      )}
      <span className="truncate">{status.label}</span>
    </span>
  )
}
