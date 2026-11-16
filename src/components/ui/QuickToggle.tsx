import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

/**
 * One-click done toggle. Flips instantly (optimistic) with a springy check,
 * then calls onChange; the store update follows in the same tick.
 */
export function QuickToggle({
  done,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  done: boolean
  onChange: (done: boolean) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const [optimistic, setOptimistic] = useState(done)
  useEffect(() => setOptimistic(done), [done])
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
      disabled={disabled}
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const next = !optimistic
        setOptimistic(next)
        onChange(next)
      }}
      className={cn(
        'relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        dim,
        optimistic
          ? 'border-success bg-success text-[#0F0100]'
          : 'border-border-strong hover:border-success',
      )}
    >
      {optimistic && (
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 700, damping: 18 }}
        >
          <Check className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={3} />
        </motion.span>
      )}
      {optimistic && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-success"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.5 }}
          aria-hidden
        />
      )}
    </motion.button>
  )
}
