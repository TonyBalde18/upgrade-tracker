import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { useReducedMotion } from '@/theme/motion'

const COLORS = ['#E1292C', '#FF6B6B', '#FFFFFF', '#FBBF24', '#4ADE80']

/** A short burst of brand-coloured pieces, played when an upgrade reaches 100%. */
export function Celebration({ show, onDone }: { show: boolean; onDone: () => void }) {
  const reduced = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const angle = (i / 42) * Math.PI * 2 + Math.random() * 0.3
        const dist = 140 + Math.random() * 220
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 80,
          rot: Math.random() * 540 - 270,
          color: COLORS[i % COLORS.length],
          w: 6 + Math.random() * 6,
          h: 3 + Math.random() * 5,
          delay: Math.random() * 0.12,
        }
      }),
    // new pieces every time it is shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [show],
  )
  return (
    <AnimatePresence onExitComplete={() => undefined}>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        >
          {!reduced &&
            pieces.map((p) => (
              <motion.span
                key={p.id}
                className="absolute rounded-[2px]"
                style={{ width: p.w, height: p.h, backgroundColor: p.color }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
                animate={{ x: p.x, y: p.y + 260, rotate: p.rot, opacity: 0, scale: 1 }}
                transition={{ duration: 1.6, delay: p.delay, ease: [0.15, 0.7, 0.3, 1] }}
              />
            ))}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            onAnimationComplete={() => setTimeout(onDone, 1400)}
            className="rounded-2xl border border-border bg-surface/90 px-6 py-4 text-center shadow-lift backdrop-blur"
          >
            <div className="eyebrow text-accent-text">Upgrade complete</div>
            <div className="mt-1 font-heading text-xl font-bold">Every step is done</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
