import { useEffect, useState } from 'react'
import { useTracker } from '@/store/tracker'

function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** True when animations should be reduced (Settings "off", or "system" + OS preference). */
export function useReducedMotion(): boolean {
  const pref = useTracker((s) => s.doc.settings.reducedMotion)
  const [system, setSystem] = useState(systemPrefersReduced)
  useEffect(() => {
    let mq: MediaQueryList | null = null
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const onChange = () => setSystem(mq?.matches ?? false)
    mq.addEventListener('change', onChange)
    return () => mq?.removeEventListener('change', onChange)
  }, [])
  if (pref === 'off') return true
  if (pref === 'on') return false
  return system
}

/** Spring presets used across the app. */
export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 36 },
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  layout: { type: 'spring', stiffness: 380, damping: 34 },
} as const
