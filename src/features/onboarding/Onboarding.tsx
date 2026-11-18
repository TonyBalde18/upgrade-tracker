import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Building2, Database, FileUp, History } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/misc'
import { RedFlow } from '@/components/ui/RedFlow'
import { useTracker } from '@/store/tracker'
import { importBackup, loadDemoData, uploadLegacyData } from '@/app/actions'
import { forgetLegacyDoc, readLegacyDoc } from '@/lib/storage/legacy'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } },
}

/** First run: paste customers (one per line), load demo data, or restore a backup. */
export function Onboarding() {
  const [text, setText] = useState('')
  const [legacy, setLegacy] = useState(readLegacyDoc)
  const addCustomers = useTracker((s) => s.addCustomers)
  const names = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const create = () => {
    const n = addCustomers(names)
    if (n > 0) {
      toast.success(`${n} customer${n > 1 ? 's' : ''} created`, {
        description: 'Next: create the first upgrade with the "New upgrade" button.',
      })
      setText('')
    } else toast('Those customers already exist')
  }

  return (
    <div className="relative isolate min-h-full overflow-hidden">
      <div className="bg-pattern-grid absolute inset-0 -z-20" />
      <RedFlow className="-z-10" lines={9} />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-14"
      >
        <motion.div variants={item}>
          <div className="eyebrow mb-3 text-accent-text">We make work flow</div>
          <h1 className="text-4xl font-extrabold tracking-tight">Welcome to Upgrade Tracker</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Plan and track ServiceNow family-release upgrades for all your customers in one place.
            Your data is private to your Google account and saved automatically on every device you
            sign in with.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <motion.div variants={item} className="lg:col-span-3">
            <Card className="flex h-full flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Add your customers</h2>
                  <p className="text-sm text-muted">
                    Paste the names, one per line. No upgrades are created yet.
                  </p>
                </div>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Customer one\nCustomer two\nCustomer three'}
                className="min-h-40 font-mono text-[0.8rem]"
                aria-label="Customer names, one per line"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-subtle">
                  {names.length} name{names.length === 1 ? '' : 's'}
                </span>
                <Button variant="primary" disabled={names.length === 0} onClick={create}>
                  Create customers <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <motion.div variants={item}>
              <Card className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-accent-text" />
                  <h2 className="font-semibold">Try it with demo data</h2>
                </div>
                <p className="text-sm text-muted">
                  Six fictional customers (Acme Corp, Globex…) with upgrades around today.
                </p>
                <Button onClick={() => void loadDemoData()}>Load demo data</Button>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-3">
                  <FileUp className="h-5 w-5 text-accent-text" />
                  <h2 className="font-semibold">Restore a backup</h2>
                </div>
                <p className="text-sm text-muted">Import a JSON file exported from this app.</p>
                <Button onClick={() => void importBackup()}>Import JSON</Button>
              </Card>
            </motion.div>
            {legacy && (
              <motion.div variants={item}>
                <Card className="flex flex-col gap-3 border-accent/40 p-6">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-accent-text" />
                    <h2 className="font-semibold">Data from the previous version</h2>
                  </div>
                  <p className="text-sm text-muted">
                    This browser still has {legacy.customers.length} customer(s) and{' '}
                    {legacy.upgrades.length} upgrade(s) from before the switch to sign-in.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => void uploadLegacyData()}>
                      Upload it
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        forgetLegacyDoc()
                        setLegacy(null)
                      }}
                    >
                      Discard
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
