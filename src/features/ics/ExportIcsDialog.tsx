import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarPlus, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useUi } from '@/store/ui'
import { useTracker } from '@/store/tracker'
import { buildIcs, downloadIcs, ICS_SCOPE_LABEL, slug, type IcsScope } from '@/lib/ics'
import { todayIn } from '@/lib/dates'
import { isActiveUpgrade } from '@/lib/upgrade/logic'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

const SCOPE_HINT: Record<IcsScope, string> = {
  windows: 'DEV, UAT and PROD windows as timed events.',
  milestones: 'Windows plus milestones (freeze, clones, alignment and Go / No-Go calls).',
  all: 'Every step: multi-day tasks as all-day events that do not block your calendar.',
}

/** The page URL without the hash, e.g. https://tonybalde18.github.io/upgrade-tracker/ */
function appUrl(): string {
  try {
    return `${window.location.origin}${window.location.pathname}`
  } catch {
    return ''
  }
}

function Body() {
  const target = useUi((s) => s.icsTarget)
  const close = useUi((s) => s.setIcsTarget)
  const doc = useTracker((s) => s.doc)
  const [scope, setScope] = useState<IcsScope>('milestones')
  const today = todayIn(doc.settings.displayTimeZone)

  const upgrade =
    target?.kind === 'upgrade' ? doc.upgrades.find((u) => u.id === target.id) : undefined
  const customer = upgrade ? doc.customers.find((c) => c.id === upgrade.customerId) : undefined
  const upgrades = useMemo(
    () =>
      target?.kind === 'upgrade'
        ? upgrade
          ? [upgrade]
          : []
        : doc.upgrades.filter((u) => isActiveUpgrade(u, doc.settings)),
    [target, upgrade, doc.upgrades, doc.settings],
  )
  const result = useMemo(
    () =>
      buildIcs({
        upgrades,
        customers: doc.customers,
        settings: doc.settings,
        template: doc.template,
        scope,
        appUrl: appUrl(),
        from: target?.kind === 'upcoming' ? today : undefined,
      }),
    [upgrades, doc.customers, doc.settings, doc.template, scope, target, today],
  )

  const download = () => {
    const name =
      target?.kind === 'upgrade' && upgrade
        ? `upgrade-${slug(customer?.name ?? 'customer')}-${slug(upgrade.family)}.ics`
        : `upgrades-upcoming-${today}.ics`
    downloadIcs(result.text, name)
    toast.success(`${result.count} event${result.count === 1 ? '' : 's'} exported`, {
      description: 'Open the file to add them to Outlook.',
    })
    close(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <Segmented<IcsScope>
        ariaLabel="What to export"
        value={scope}
        onChange={setScope}
        options={(['windows', 'milestones', 'all'] as const).map((s) => ({
          value: s,
          label: ICS_SCOPE_LABEL[s],
        }))}
      />
      <motion.p
        key={scope}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-muted"
      >
        {SCOPE_HINT[scope]}
      </motion.p>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-4">
        <CalendarPlus className="h-8 w-8 text-accent-text" />
        <div>
          <div className="font-heading text-2xl font-bold tabular">
            <AnimatedNumber value={result.count} />{' '}
            <span className="text-base font-medium text-muted">
              event{result.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-xs text-subtle">
            {target?.kind === 'upgrade'
              ? `${customer?.name ?? ''}: ${upgrade?.fromFamily} → ${upgrade?.family}`
              : `From today, ${upgrades.length} active upgrade(s)`}
          </div>
        </div>
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none">
          How to import into Outlook (Windows)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Double-click the downloaded .ics file, or in Outlook: File → Open &amp; Export →
            Import/Export → “Import an iCalendar (.ics)” → Import.
          </li>
          <li>Choose “Import” (not “Open as New”) to add the events to your own calendar.</li>
          <li>
            Export again after changes: events keep the same ID, so Outlook updates them instead of
            creating duplicates.
          </li>
        </ol>
      </details>
      <div className="flex justify-end gap-2">
        <Button onClick={() => close(null)}>Cancel</Button>
        <Button variant="primary" disabled={result.count === 0} onClick={download}>
          <Download className="h-4 w-4" /> Download .ics
        </Button>
      </div>
    </div>
  )
}

export function ExportIcsDialog() {
  const target = useUi((s) => s.icsTarget)
  const close = useUi((s) => s.setIcsTarget)
  return (
    <Dialog
      open={target != null}
      onOpenChange={(o) => !o && close(null)}
      title={
        target?.kind === 'upgrade'
          ? 'Export this upgrade to your calendar'
          : 'Export all upcoming to your calendar'
      }
      description="Creates an .ics file for Outlook, Google Calendar or Apple Calendar."
    >
      {target && <Body />}
    </Dialog>
  )
}
