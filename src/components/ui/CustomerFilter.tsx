import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { CustomerAvatar } from './misc'
import { cn } from './cn'

/**
 * Choose which customers the canvas, timeline and week views show. Nothing chosen
 * means all customers. The choice is shared by those views and kept in this browser.
 */
export function CustomerFilter({ className }: { className?: string }) {
  const customers = useTracker((s) => s.doc.customers)
  const selected = useUi((s) => s.customerFilter)
  const setSelected = useUi((s) => s.setCustomerFilter)
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  )
  const chosen = sorted.filter((c) => selected.includes(c.id))
  const q = query.trim().toLowerCase()
  const shown = q
    ? sorted.filter((c) => `${c.name} ${c.shortName}`.toLowerCase().includes(q))
    : sorted

  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected.filter((x) => customers.some((c) => c.id === x)), id],
    )

  const label =
    chosen.length === 0
      ? 'All customers'
      : chosen.length === 1
        ? chosen[0]!.name
        : `${chosen.length} customers`

  return (
    <div className={cn('flex items-center', className)}>
      <Popover.Root onOpenChange={(o) => !o && setQuery('')}>
        <Popover.Trigger
          className={cn(
            'inline-flex h-8 min-w-0 max-w-52 cursor-pointer items-center gap-2 border bg-surface px-3 text-xs',
            'hover:border-border-strong focus:outline-none focus-visible:border-accent',
            chosen.length ? 'rounded-l-lg border-accent text-text' : 'rounded-lg border-border',
          )}
          aria-label={`Customer filter: ${label}`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-subtle" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="ut-pop z-50 flex w-72 flex-col rounded-xl border border-border bg-surface shadow-lift"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a customer…"
                aria-label="Find a customer"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </div>
            <div className="max-h-72 overflow-auto p-1" role="listbox" aria-multiselectable>
              {shown.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-subtle">No customer found</p>
              )}
              {shown.map((c) => {
                const on = selected.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(c.id)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        on ? 'border-accent bg-accent text-white' : 'border-border-strong',
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <CustomerAvatar name={c.name} color={c.color} logo={c.logo} size={20} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {!c.active && <span className="text-[0.65rem] text-subtle">inactive</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border p-2 text-xs">
              <button
                type="button"
                className="cursor-pointer rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-text"
                onClick={() => setSelected(sorted.filter((c) => c.active).map((c) => c.id))}
              >
                Active customers
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
                disabled={selected.length === 0}
                onClick={() => setSelected([])}
              >
                Show all
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {chosen.length > 0 && (
        <button
          type="button"
          onClick={() => setSelected([])}
          className="flex h-8 cursor-pointer items-center rounded-r-lg border border-l-0 border-accent bg-surface px-1.5 text-subtle hover:text-text"
          aria-label="Clear customer filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
