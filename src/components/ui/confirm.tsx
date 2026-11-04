import { create } from 'zustand'
import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmRequest {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }))

/** Promise-based confirmation, e.g. `if (await confirm({ title: 'Delete?' })) ...` */
export function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ req: { ...opts, resolve } })
  })
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req)
  const close = (ok: boolean) => {
    req?.resolve(ok)
    useConfirmStore.setState({ req: null })
  }
  return (
    <Dialog
      open={req != null}
      onOpenChange={(o) => !o && close(false)}
      title={req?.title ?? ''}
      description={req?.body}
      footer={
        <>
          <Button onClick={() => close(false)}>{req?.cancelLabel ?? 'Cancel'}</Button>
          <Button
            variant={req?.danger ? 'danger' : 'primary'}
            onClick={() => close(true)}
            autoFocus
          >
            {req?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    />
  )
}
