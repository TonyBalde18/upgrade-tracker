import { create } from 'zustand'
import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'

export interface Choice<T extends string> {
  value: T
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
}

interface Request {
  title: string
  body?: ReactNode
  choices: Choice<string>[]
  resolve: (value: string | null) => void
}

const useConfirmStore = create<{ req: Request | null }>(() => ({ req: null }))

/** Promise-based choice between several buttons. Resolves null when dismissed. */
export function choose<T extends string>(opts: {
  title: string
  body?: ReactNode
  choices: Choice<T>[]
}): Promise<T | null> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ req: { ...opts, resolve: resolve as (v: string | null) => void } })
  })
}

/** Promise-based confirmation, e.g. `if (await confirm({ title: 'Delete?' })) ...` */
export async function confirm(opts: {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}): Promise<boolean> {
  const v = await choose({
    title: opts.title,
    body: opts.body,
    choices: [
      { value: 'cancel', label: opts.cancelLabel ?? 'Cancel', variant: 'secondary' },
      {
        value: 'ok',
        label: opts.confirmLabel ?? 'Confirm',
        variant: opts.danger ? 'danger' : 'primary',
      },
    ],
  })
  return v === 'ok'
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req)
  const close = (v: string | null) => {
    req?.resolve(v)
    useConfirmStore.setState({ req: null })
  }
  return (
    <Dialog
      open={req != null}
      onOpenChange={(o) => !o && close(null)}
      title={req?.title ?? ''}
      description={req?.body}
      footer={
        <>
          {req?.choices.map((c, i) => (
            <Button
              key={c.value}
              variant={c.variant ?? 'secondary'}
              onClick={() => close(c.value)}
              autoFocus={i === req.choices.length - 1}
            >
              {c.label}
            </Button>
          ))}
        </>
      }
    />
  )
}
