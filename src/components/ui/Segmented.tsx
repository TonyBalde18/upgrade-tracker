import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { cn } from './cn'

/** Pill switcher with a sliding highlight (spring layout animation). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  ariaLabel?: string
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded-lg border border-border bg-surface-2 p-0.5', className)}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative z-0 flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors cursor-pointer',
              selected ? 'text-text' : 'text-subtle hover:text-muted',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-md bg-surface shadow-card ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
