import { motion } from 'motion/react'
import type { PhaseFlowStep } from '@/lib/timeline'
import { formatDay } from '@/lib/dates'
import { phaseTone } from '@/theme/brand'
import { useReducedMotion } from '@/theme/motion'
import { Tooltip } from './Tooltip'
import { cn } from './cn'

const SHORT: Record<string, string> = {
  Preparation: 'Prep',
  'Go-live': 'Go/No-Go',
  Hypercare: 'Care',
}

/** Six segments, one per phase: where the upgrade is now. The current phase carries the red flow. */
export function PhaseFlowBar({ flow, labels = true }: { flow: PhaseFlowStep[]; labels?: boolean }) {
  const reduced = useReducedMotion()
  const current = flow.find((f) => f.state === 'current' || f.state === 'blocked')
  return (
    <div
      className="flex flex-col gap-1"
      role="img"
      aria-label={current ? `Current phase: ${current.phase}` : 'All phases done'}
    >
      <div className="flex gap-1">
        {flow.map((f, i) => {
          const tone = phaseTone[f.phase]
          return (
            <Tooltip
              key={f.phase}
              content={
                <span>
                  <b>{f.phase}</b> · {f.state === 'na' ? 'N/A' : f.state}
                  {f.span && (
                    <>
                      <br />
                      {formatDay(f.span.start, 'd MMM')} to {formatDay(f.span.end, 'd MMM')} ·{' '}
                      {f.span.done}/{f.span.total} done
                    </>
                  )}
                </span>
              }
            >
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
                className={cn(
                  'relative h-2 flex-1 origin-left overflow-hidden rounded-full',
                  f.state === 'current' && 'bg-accent',
                  f.state === 'current' && !reduced && 'flow-shimmer',
                  f.state === 'blocked' && 'bg-problem-stripes ring-1 ring-danger',
                  f.state === 'future' && 'border',
                  f.state === 'na' && 'border border-dashed border-border',
                )}
                style={{
                  backgroundColor: f.state === 'done' ? `var(--tone-${tone}-solid)` : undefined,
                  borderColor: f.state === 'future' ? `var(--tone-${tone}-solid)` : undefined,
                  opacity: f.state === 'na' ? 0.5 : undefined,
                }}
              />
            </Tooltip>
          )
        })}
      </div>
      {labels && (
        <div className="flex gap-1">
          {flow.map((f) => (
            <span
              key={f.phase}
              className={cn(
                'flex-1 truncate text-center text-[0.6rem]',
                f === current ? 'font-bold text-accent-text' : 'text-subtle',
              )}
            >
              {SHORT[f.phase] ?? f.phase}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
