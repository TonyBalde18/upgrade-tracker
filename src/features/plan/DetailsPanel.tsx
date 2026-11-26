import { AnimatePresence, motion } from 'motion/react'
import { Lightbulb, X } from 'lucide-react'
import type { Customer, Upgrade } from '@/lib/model/types'
import { setUpgradeDocuments, updateUpgradeMeta } from '@/store/upgradeActions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { DocLinkList, DocLinksEditor } from '@/components/ui/DocLinks'

/** Earlier upgrades of the same customer that have lessons learned, newest first. */
export function previousLessons(upgrade: Upgrade, all: Upgrade[]): Upgrade[] {
  return all
    .filter(
      (u) =>
        u.customerId === upgrade.customerId &&
        u.id !== upgrade.id &&
        u.lessonsLearned.trim() &&
        u.windows.prod.start < upgrade.windows.prod.start,
    )
    .sort((a, b) => b.windows.prod.start.localeCompare(a.windows.prod.start))
}

/** Slide-over panel: document links, lessons learned, and lessons from earlier upgrades. */
export function DetailsPanel({
  upgrade,
  customer,
  earlier,
  open,
  onClose,
  readOnly,
}: {
  upgrade: Upgrade
  customer: Customer | undefined
  earlier: Upgrade[]
  open: boolean
  onClose: () => void
  readOnly: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          className="absolute top-0 right-0 bottom-0 z-30 flex w-[min(460px,94vw)] flex-col border-l border-border bg-surface shadow-lift"
          aria-label="Documents and lessons learned"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <div className="eyebrow">This upgrade</div>
              <h2 className="font-semibold">Documents & lessons learned</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            {earlier.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-warning" /> Lessons from earlier upgrades
                </h3>
                {earlier.map((u) => (
                  <div key={u.id} className="flex flex-col gap-0.5">
                    <div className="text-xs font-medium text-muted">
                      {u.fromFamily} → {u.family} ({u.cycle})
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{u.lessonsLearned}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Documents</h3>
              <p className="text-xs text-subtle">
                Links to runbooks, smoke-test evidence and other files kept in SharePoint. Only the
                link is stored here.
              </p>
              <DocLinksEditor
                links={upgrade.documents}
                readOnly={readOnly}
                onChange={(links, what) => setUpgradeDocuments(upgrade.id, links, what)}
              />
            </section>

            {customer && customer.documents.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{customer.name} documents</h3>
                <DocLinkList links={customer.documents} />
              </section>
            )}

            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="lessons">
                Lessons learned
              </label>
              <p className="text-xs text-subtle">
                What went well or wrong. Shown on the next upgrade of{' '}
                {customer?.name ?? 'this customer'}.
              </p>
              <Textarea
                id="lessons"
                key={upgrade.lessonsLearned}
                defaultValue={upgrade.lessonsLearned}
                readOnly={readOnly}
                placeholder="e.g. Clone took 6 hours instead of 3: start it on Friday."
                onBlur={(e) =>
                  e.target.value !== upgrade.lessonsLearned &&
                  updateUpgradeMeta(upgrade.id, { lessonsLearned: e.target.value })
                }
                className="min-h-32"
              />
            </section>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
