import { useEffect, useState } from 'react'
import { useTracker } from '@/store/tracker'
import { themes } from '@/theme/brand'

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

/** Applies the theme (html.dark) and motion preference (html.reduce-motion / force-motion). */
export function useAppliedTheme(): 'dark' | 'light' {
  const theme = useTracker((s) => s.doc.settings.theme)
  const motionPref = useTracker((s) => s.doc.settings.reducedMotion)
  const [sysDark, setSysDark] = useState(systemDark)

  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    const fn = () => setSysDark(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const effective = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', effective === 'dark')
    root.classList.toggle('reduce-motion', motionPref === 'off')
    root.classList.toggle('force-motion', motionPref === 'on')
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', themes[effective].bg ?? '#0F0100')
  }, [effective, motionPref])

  return effective
}
