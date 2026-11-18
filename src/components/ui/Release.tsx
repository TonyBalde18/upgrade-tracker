import { ArrowRight } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { releaseLogoOf } from '@/lib/releases'
import { cn } from './cn'

/** The release's logo (from Settings > Releases), or nothing when it has none. */
export function ReleaseIcon({
  family,
  size = 16,
  className,
}: {
  family: string
  size?: number
  className?: string
}) {
  const logo = useTracker((s) => releaseLogoOf(s.doc.settings, family))
  if (!logo) return null
  return (
    <img
      src={logo}
      alt=""
      draggable={false}
      className={cn('shrink-0 rounded-[22%] object-cover ring-1 ring-white/10', className)}
      style={{ width: size, height: size }}
    />
  )
}

/** "Australia" with its logo in front. */
export function Release({
  family,
  size = 16,
  className,
}: {
  family: string
  size?: number
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <ReleaseIcon family={family} size={size} />
      <span className="truncate">{family}</span>
    </span>
  )
}

/** "Zurich → Australia", each with its logo. */
export function ReleasePath({
  from,
  to,
  size = 16,
  className,
  toClassName,
}: {
  from: string
  to: string
  size?: number
  className?: string
  toClassName?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Release family={from} size={size} />
      <ArrowRight
        className="shrink-0 text-accent-text"
        style={{ width: size * 0.8, height: size * 0.8 }}
        aria-label="to"
      />
      <Release family={to} size={size} className={toClassName} />
    </span>
  )
}
