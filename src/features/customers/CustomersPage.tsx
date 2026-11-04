import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, ClipboardPaste } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { Button } from '@/components/ui/Button'
import { Card, CustomerChip, SectionTitle } from '@/components/ui/misc'
import { Dialog } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'

/** Phase 1: list + bulk paste. Full editing and history arrive in phase 2. */
export default function CustomersPage() {
  const customers = useTracker((s) => s.doc.customers)
  const upgrades = useTracker((s) => s.doc.upgrades)
  const addCustomers = useTracker((s) => s.addCustomers)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const submit = () => {
    const n = addCustomers(text.split(/\r?\n/))
    toast.success(n ? `${n} customer(s) added` : 'Nothing new to add')
    setText('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <SectionTitle
        eyebrow="Directory"
        title="Customers"
        actions={
          <Button onClick={() => setOpen(true)}>
            <ClipboardPaste className="h-4 w-4" /> Paste names
          </Button>
        }
      />
      {customers.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No customers yet"
          body="Paste your customer names, one per line, to create them in bulk."
          actions={
            <Button variant="primary" onClick={() => setOpen(true)}>
              Paste names
            </Button>
          }
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {customers.map((c) => {
            const count = upgrades.filter((u) => u.customerId === c.id).length
            return (
              <motion.div
                key={c.id}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              >
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <CustomerChip color={c.color} label={c.name} className="font-medium" />
                    <div className="mt-1 text-xs text-subtle">
                      {c.shortName} · {count} upgrade{count === 1 ? '' : 's'}
                      {!c.active && ' · inactive'}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Paste customer names"
        description="One name per line. Duplicates and existing customers are skipped."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!text.trim()}>
              Add customers
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-48 font-mono text-[0.8rem]"
          aria-label="Customer names"
        />
      </Dialog>
    </div>
  )
}
