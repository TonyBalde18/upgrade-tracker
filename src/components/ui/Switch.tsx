import { Switch as S } from 'radix-ui'
import { cn } from './cn'

export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  className?: string
}) {
  return (
    <S.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        'relative h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border-strong bg-surface-3 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
    >
      <S.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[17px]" />
    </S.Root>
  )
}
