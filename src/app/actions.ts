/** App-level actions shared by the command palette, shortcuts and buttons. */
import { toast } from 'sonner'
import { buildDemoDoc } from '@/demo/demo-data'
import { exportJson, pickJsonFile } from '@/lib/storage/backup'
import { emptyDoc } from '@/lib/model/defaults'
import { useTracker } from '@/store/tracker'
import { saveNow } from '@/store/persistence'
import { confirm } from '@/components/ui/confirm'
import { loadConnection } from '@/lib/github/config'

function hasData(): boolean {
  const { doc } = useTracker.getState()
  return doc.customers.length > 0 || doc.upgrades.length > 0
}

export async function loadDemoData(): Promise<void> {
  if (loadConnection().mode === 'github') {
    toast.error('Demo data is only available in Local mode', {
      description:
        'In GitHub mode it would replace your real data in the data repository. Switch to Local mode in Settings first.',
    })
    return
  }
  if (hasData()) {
    const ok = await confirm({
      title: 'Replace your data with demo data?',
      body: 'All current customers and upgrades in this browser will be replaced by fictional demo data. Export a JSON backup first if you want to keep them.',
      confirmLabel: 'Load demo data',
      danger: true,
    })
    if (!ok) return
  }
  const store = useTracker.getState()
  const keep = store.doc.settings
  const demo = buildDemoDoc()
  demo.settings = { ...demo.settings, theme: keep.theme, reducedMotion: keep.reducedMotion }
  store.replaceDoc(demo, { dirty: true, description: 'Load demo data' })
  saveNow()
  toast.success('Demo data loaded', { description: '6 fictional customers and 5 upgrades.' })
}

export async function clearAllData(): Promise<void> {
  const ok = await confirm({
    title: 'Clear all data in this browser?',
    body:
      loadConnection().mode === 'github'
        ? 'Customers, upgrades and your template edits will be removed, here AND in tracker.json on GitHub (the repository history keeps older versions). Settings like theme are kept.'
        : 'Customers, upgrades and your template edits will be removed from this browser. Settings like theme are kept. This can not be undone.',
    confirmLabel: 'Clear data',
    danger: true,
  })
  if (!ok) return
  const store = useTracker.getState()
  const fresh = emptyDoc()
  fresh.settings = store.doc.settings
  store.replaceDoc(fresh, { dirty: true, description: 'Clear all data' })
  saveNow()
  toast('All data cleared')
}

export function exportBackup(): void {
  exportJson(useTracker.getState().doc)
  toast.success('Backup downloaded', {
    description: 'Keep it somewhere private: it contains customer data.',
  })
}

export async function importBackup(): Promise<void> {
  try {
    const doc = await pickJsonFile()
    if (!doc) return
    const ok = await confirm({
      title: 'Import this backup?',
      body: `It contains ${doc.customers.length} customer(s) and ${doc.upgrades.length} upgrade(s). It will replace all current data.`,
      confirmLabel: 'Import and replace',
      danger: hasData(),
    })
    if (!ok) return
    useTracker.getState().replaceDoc(doc, { dirty: true, description: 'Import JSON backup' })
    saveNow()
    toast.success('Backup imported')
  } catch (e) {
    toast.error('Import failed', { description: e instanceof Error ? e.message : String(e) })
  }
}
