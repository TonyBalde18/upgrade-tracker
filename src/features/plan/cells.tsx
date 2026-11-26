/**
 * Inline-edit cells for the task table. They are real form controls, so Tab moves
 * between them natively. Enter commits and moves to the same column on the next row
 * (Shift+Enter: previous row), Esc cancels.
 */
import { Select as S } from 'radix-ui'
import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatDay } from '@/lib/dates'
import type { StatusDef } from '@/lib/model/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/components/ui/cn'

const cellInput =
  'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[0.8rem] text-text ' +
  'placeholder:text-subtle hover:border-border focus:border-accent focus:bg-surface focus:outline-none'

/** Focus the same column in the next / previous row of the same grid. */
export function moveFocus(from: HTMLElement, dir: 1 | -1): void {
  const col = from.closest('[data-col]')?.getAttribute('data-col')
  const grid = from.closest('[data-grid]')
  const row = from.closest('[data-row]')
  if (!col || !grid || !row) return
  const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-row]'))
  const next = rows[rows.indexOf(row as HTMLElement) + dir]
  const target = next?.querySelector<HTMLElement>(
    `[data-col="${col}"] input, [data-col="${col}"] button`,
  )
  target?.focus()
}

function useDraft(value: string) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  return { draft, setDraft, focused }
}

export function TextCell({
  value,
  onCommit,
  placeholder,
  ariaLabel,
  className,
  col,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  ariaLabel: string
  className?: string
  col: string
}) {
  const { draft, setDraft, focused } = useDraft(value)
  const cancelled = useRef(false)
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim())
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      moveFocus(e.currentTarget, e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      cancelled.current = true
      setDraft(value)
      e.currentTarget.blur()
    }
  }
  return (
    <div data-col={col} className={cn('min-w-0', className)}>
      <input
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        title={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focused.current = true
          cancelled.current = false
        }}
        onBlur={() => {
          focused.current = false
          if (!cancelled.current) commit()
        }}
        onKeyDown={onKey}
        className={cn(cellInput, 'truncate')}
      />
    </div>
  )
}

const validYear = (v: string) => {
  const y = Number(v.slice(0, 4))
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && y >= 2000 && y <= 2100
}

/** Shows "Mon 23 Nov 2026"; becomes a native date input while focused. */
export function DateCell({
  value,
  onCommit,
  ariaLabel,
  col,
  className,
}: {
  value: string | null
  onCommit: (v: string | null) => void
  ariaLabel: string
  col: string
  className?: string
}) {
  const [focus, setFocus] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div data-col={col} className={cn('relative min-w-0', className)}>
      <span
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center truncate px-2 text-[0.8rem] tabular',
          value ? 'text-text' : 'text-subtle',
          focus && 'invisible',
        )}
      >
        {value ? formatDay(value) : 'N/A'}
      </span>
      <input
        ref={ref}
        type="date"
        aria-label={ariaLabel}
        value={value ?? ''}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onClick={() => {
          try {
            ref.current?.showPicker()
          } catch {
            /* not supported */
          }
        }}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') return
          if (validYear(v) && v !== value) onCommit(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            moveFocus(e.currentTarget, e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') e.currentTarget.blur()
        }}
        className={cn(
          cellInput,
          'cursor-pointer tabular',
          !focus && 'text-transparent [&::-webkit-calendar-picker-indicator]:opacity-0',
        )}
      />
    </div>
  )
}

/** Optional time of day ("HH:mm"). Empty = no time. */
export function TimeCell({
  value,
  onCommit,
  ariaLabel,
  col,
  title,
}: {
  value: string | null
  onCommit: (v: string | null) => void
  ariaLabel: string
  col: string
  title?: string
}) {
  const { draft, setDraft, focused } = useDraft(value ?? '')
  return (
    <div data-col={col} className="min-w-0" title={title}>
      <input
        type="time"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          const v = draft || null
          if (v !== value) onCommit(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            moveFocus(e.currentTarget, e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            setDraft(value ?? '')
          }
        }}
        className={cn(cellInput, 'tabular', !draft && 'text-subtle')}
      />
    </div>
  )
}

const popCls =
  'ut-pop z-50 max-h-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lift'
const itemCls =
  'relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-surface-2'

const NONE = '__none__'

/** Pick one of a list (owner, assignee). Keeps a value that is no longer in the list. */
export function PickCell({
  value,
  options,
  onCommit,
  ariaLabel,
  col,
  emptyLabel,
}: {
  value: string
  options: string[]
  onCommit: (v: string) => void
  ariaLabel: string
  col: string
  /** offer an empty choice with this label (e.g. "Nobody") */
  emptyLabel?: string
}) {
  const all = value && !options.includes(value) ? [value, ...options] : options
  return (
    <div data-col={col} className="min-w-0">
      <S.Root
        value={value || (emptyLabel ? NONE : undefined)}
        onValueChange={(v) => onCommit(v === NONE ? '' : v)}
      >
        <S.Trigger
          aria-label={ariaLabel}
          className={cn(cellInput, 'flex items-center truncate text-left cursor-pointer')}
        >
          <S.Value placeholder="Pick…" />
        </S.Trigger>
        <S.Portal>
          <S.Content position="popper" sideOffset={4} className={popCls}>
            <S.Viewport className="p-1">
              {emptyLabel && (
                <S.Item value={NONE} className={cn(itemCls, 'text-subtle')}>
                  <S.ItemText>{emptyLabel}</S.ItemText>
                </S.Item>
              )}
              {all.map((o) => (
                <S.Item key={o} value={o} className={itemCls}>
                  <S.ItemText>{o}</S.ItemText>
                  <S.ItemIndicator className="absolute right-2">
                    <Check className="h-4 w-4 text-accent-text" />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  )
}

/** Colour-coded status dropdown (badge = icon + text). */
export function StatusCell({
  value,
  statuses,
  onCommit,
  ariaLabel,
  col,
  size = 'sm',
}: {
  value: string
  statuses: StatusDef[]
  onCommit: (v: string) => void
  ariaLabel: string
  col?: string
  size?: 'sm' | 'md'
}) {
  const current = statuses.find((s) => s.id === value)
  return (
    <div data-col={col} className="min-w-0">
      <S.Root value={value} onValueChange={onCommit}>
        <S.Trigger
          aria-label={`${ariaLabel}: ${current?.label ?? 'unknown'}`}
          className="flex h-8 max-w-full items-center rounded-md border border-transparent px-1 hover:border-border focus:border-accent focus:outline-none cursor-pointer"
        >
          <StatusBadge status={current} size={size} />
        </S.Trigger>
        <S.Portal>
          <S.Content position="popper" sideOffset={4} className={popCls}>
            <S.Viewport className="p-1">
              {statuses.map((s) => (
                <S.Item key={s.id} value={s.id} className={itemCls}>
                  <S.ItemText asChild>
                    <span>
                      <StatusBadge status={s} size="sm" />
                    </span>
                  </S.ItemText>
                  <S.ItemIndicator className="absolute right-2">
                    <Check className="h-4 w-4 text-accent-text" />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  )
}

/** Pick from labelled options (value differs from label). */
export function ChoiceCell<T extends string>({
  value,
  options,
  onCommit,
  ariaLabel,
  col,
}: {
  value: T
  options: { value: T; label: string }[]
  onCommit: (v: T) => void
  ariaLabel: string
  col: string
}) {
  return (
    <div data-col={col} className="min-w-0">
      <S.Root value={value} onValueChange={(v) => onCommit(v as T)}>
        <S.Trigger
          aria-label={ariaLabel}
          className={cn(cellInput, 'flex items-center truncate text-left cursor-pointer')}
        >
          <S.Value />
        </S.Trigger>
        <S.Portal>
          <S.Content position="popper" sideOffset={4} className={popCls}>
            <S.Viewport className="p-1">
              {options.map((o) => (
                <S.Item key={o.value} value={o.value} className={itemCls}>
                  <S.ItemText>{o.label}</S.ItemText>
                  <S.ItemIndicator className="absolute right-2">
                    <Check className="h-4 w-4 text-accent-text" />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  )
}

/** Integer input that commits on blur / Enter. */
export function NumberCell({
  value,
  onCommit,
  ariaLabel,
  col,
  min,
  disabled,
}: {
  value: number
  onCommit: (v: number) => void
  ariaLabel: string
  col: string
  min?: number
  disabled?: boolean
}) {
  const { draft, setDraft, focused } = useDraft(String(value))
  const commit = () => {
    const n = Math.trunc(Number(draft))
    if (Number.isFinite(n) && (min == null || n >= min) && n !== value) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <div data-col={col} className="min-w-0">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft}
        min={min}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            moveFocus(e.currentTarget, e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') setDraft(String(value))
        }}
        className={cn(cellInput, 'text-right tabular disabled:opacity-40')}
      />
    </div>
  )
}
