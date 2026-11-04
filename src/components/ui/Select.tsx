import { Select as S } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  ariaLabel,
  renderValue,
  size = 'md',
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  ariaLabel?: string
  renderValue?: (o: SelectOption | undefined) => ReactNode
  size?: 'sm' | 'md'
}) {
  const current = options.find((o) => o.value === value)
  return (
    <S.Root value={value} onValueChange={onChange}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text',
          'hover:border-border-strong focus:outline-none focus:border-accent data-[placeholder]:text-subtle cursor-pointer',
          size === 'sm' ? 'h-8 text-xs' : 'h-9',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {renderValue ? renderValue(current) : <S.Value placeholder={placeholder} />}
        </span>
        <S.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="ut-pop z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface shadow-lift"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
              >
                {o.icon}
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
  )
}
