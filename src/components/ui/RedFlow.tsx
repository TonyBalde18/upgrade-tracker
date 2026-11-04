import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/theme/motion'
import { cn } from './cn'

/**
 * The brand's "red flow": a few slow, flowing red lines with travelling sparks.
 * Drawn on a 2D canvas at low opacity. Pauses when the tab is hidden or the
 * element is off-screen, and renders a single still frame under reduced motion.
 */
export function RedFlow({
  className,
  lines = 7,
  intensity = 1,
}: {
  className?: string
  lines?: number
  intensity?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let raf = 0
    let visible = true
    let running = false
    const start = performance.now()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    const seeds = Array.from({ length: lines }, (_, i) => ({
      base: 0.25 + (i / Math.max(1, lines - 1)) * 0.6,
      a1: 0.05 + ((i * 37) % 11) / 160,
      a2: 0.02 + ((i * 53) % 7) / 220,
      f1: 1.4 + ((i * 17) % 5) * 0.35,
      f2: 3.1 + ((i * 29) % 7) * 0.4,
      s1: 0.05 + ((i * 13) % 5) * 0.018,
      s2: 0.08 + ((i * 7) % 4) * 0.02,
      p: i * 1.7,
      alpha: (0.1 + ((i * 31) % 5) * 0.05) * intensity,
      width: 1 + ((i * 11) % 3) * 0.6,
      spark: i % 2 === 0,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const yAt = (s: (typeof seeds)[number], u: number, t: number) =>
      height *
      (s.base +
        s.a1 * Math.sin(u * s.f1 * Math.PI + t * s.s1 * 6 + s.p) +
        s.a2 * Math.sin(u * s.f2 * Math.PI - t * s.s2 * 6 + s.p * 0.7) -
        (u - 0.5) * 0.18)

    const draw = (now: number) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'
      for (const s of seeds) {
        const grad = ctx.createLinearGradient(0, 0, width, 0)
        grad.addColorStop(0, 'rgba(225,41,44,0)')
        grad.addColorStop(0.35, `rgba(225,41,44,${s.alpha})`)
        grad.addColorStop(0.7, `rgba(255,90,80,${s.alpha * 1.2})`)
        grad.addColorStop(1, 'rgba(225,41,44,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = s.width
        ctx.beginPath()
        const steps = 48
        for (let k = 0; k <= steps; k++) {
          const u = k / steps
          const x = u * width
          const y = yAt(s, u, t)
          if (k === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        if (s.spark) {
          const u = ((t * (0.04 + s.s1 * 0.4) + s.p) % 1.2) - 0.1
          if (u > 0 && u < 1) {
            const x = u * width
            const y = yAt(s, u, t)
            const g = ctx.createRadialGradient(x, y, 0, x, y, 14)
            g.addColorStop(0, `rgba(255,120,110,${0.55 * intensity})`)
            g.addColorStop(1, 'rgba(225,41,44,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(x, y, 14, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    const play = () => {
      if (running || reduced || !visible || document.hidden) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const pause = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    resize()
    draw(start + 4000)
    const ro = new ResizeObserver(() => {
      resize()
      draw(performance.now())
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) play()
      else pause()
    })
    io.observe(canvas)
    const onVis = () => (document.hidden ? pause() : play())
    document.addEventListener('visibilitychange', onVis)
    play()

    return () => {
      pause()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [lines, intensity, reduced])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
