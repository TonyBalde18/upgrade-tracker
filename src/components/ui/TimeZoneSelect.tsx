import { Popover } from 'radix-ui'
import { Command } from 'cmdk'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { allTimeZones, zoneAbbr } from '@/lib/dates'
import { cn } from './cn'

/** Searchable IANA time-zone picker. */
export function TimeZoneSelect({
  value,
  onChange,
  className,
  ariaLabel = 'Time zone',
}: {
  value: string
  onChange: (tz: string) => void
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const zones = useMemo(() => allTimeZones(), [])
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm',
          'hover:border-border-strong focus:outline-none focus:border-accent cursor-pointer',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <Globe className="h-4 w-4 shrink-0 text-subtle" />
          {value}
          <span className="text-xs text-subtle">{zoneAbbr(value)}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="ut-pop z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lift"
        >
          <Command>
            <Command.Input
              autoFocus
              placeholder="Search zones (e.g. Zurich, Lisbon)…"
              className="h-10 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-subtle"
            />
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-subtle">
                No zone found.
              </Command.Empty>
              {zones.map((tz) => (
                <Command.Item
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-surface-2"
                >
                  <span>{tz.replaceAll('_', ' ')}</span>
                  {tz === value && <Check className="h-4 w-4 text-accent-text" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
