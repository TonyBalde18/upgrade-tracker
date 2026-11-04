import { motion } from 'motion/react'
import { AnimatedNumber } from './AnimatedNumber'

/** Animated circular progress (0..1). Red stroke = brand accent, green when complete. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  label = true,
}: {
  value: number
  size?: number
  stroke?: number
  label?: boolean
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const done = value >= 1
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(value * 100)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ut-surface-3)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? 'var(--ut-success)' : 'var(--ut-accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center font-heading text-[0.72rem] font-bold tabular">
          <AnimatedNumber value={Math.round(value * 100)} format={(n) => `${Math.round(n)}%`} />
        </div>
      )}
    </div>
  )
}
