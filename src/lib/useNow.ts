import { useEffect, useState } from 'react'

/** Current time, refreshed every `intervalMs` (paused while the tab is hidden). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (id) return
      setNow(new Date())
      id = setInterval(() => setNow(new Date()), intervalMs)
    }
    const stop = () => {
      if (id) clearInterval(id)
      id = null
    }
    const onVis = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs])
  return now
}
