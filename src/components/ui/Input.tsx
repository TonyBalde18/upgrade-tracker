import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from './cn'

const base =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-subtle ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-border-strong ' +
  'focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--ut-accent-soft)] disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, 'h-9', className)} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(base, 'min-h-24 py-2 leading-relaxed', className)}
      {...props}
    />
  )
})

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}
