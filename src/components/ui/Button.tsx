import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none ' +
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ' +
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-press shadow-[0_6px_20px_-8px_var(--ut-accent-glow)]',
        secondary:
          'bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong',
        ghost: 'text-muted hover:text-text hover:bg-surface-2',
        outline: 'border border-border-strong text-text hover:border-accent hover:text-accent-text',
        danger:
          'bg-danger-soft text-danger border border-danger/40 hover:bg-danger hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />
  )
})
