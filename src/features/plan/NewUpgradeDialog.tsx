import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useUi } from '@/store/ui'

/** Placeholder: the multi-step "New upgrade" flow is built in phase 2. */
export function NewUpgradeDialog() {
  const open = useUi((s) => s.newUpgradeOpen)
  const setOpen = useUi((s) => s.setNewUpgradeOpen)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="New upgrade"
      description="The guided flow (customer, releases, windows, plan preview) arrives in phase 2."
      footer={<Button onClick={() => setOpen(false)}>Close</Button>}
    />
  )
}
