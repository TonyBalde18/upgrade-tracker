import { animate } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/theme/motion'

/** Counts smoothly from the previous value to the new one. */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = format(value)
      prev.current = value
      return
    }
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, format, reduced])

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}
