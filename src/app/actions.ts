/** App-level actions shared by the command palette, shortcuts and buttons. */
import { toast } from 'sonner'
import { buildDemoDoc } from '@/demo/demo-data'
import { exportJson, pickJsonFile } from '@/lib/storage/backup'
import { forgetLegacyDoc, readLegacyDoc } from '@/lib/storage/legacy'
import { emptyDoc } from '@/lib/model/defaults'
import { useTracker } from '@/store/tracker'
import { saveNow } from '@/store/saveControl'
import { signOutAndClear } from '@/store/auth'
import { confirm } from '@/components/ui/confirm'

function hasData(): boolean {
  const { doc } = useTracker.getState()
  return doc.customers.length > 0 || doc.upgrades.length > 0
}

export async function loadDemoData(): Promise<void> {
  if (hasData()) {
    const ok = await confirm({
      title: 'Replace your data with demo data?',
      body: 'All your customers and upgrades will be replaced by fictional demo data, on every device. Export a JSON backup first if you want to keep them.',
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
    title: 'Delete all data?',
    body: 'Customers, upgrades and your template edits are deleted from the database, on every device. Settings like theme and statuses are kept. Export a JSON backup first: this can not be undone.',
    confirmLabel: 'Delete all data',
    danger: true,
  })
  if (!ok) return
  const store = useTracker.getState()
  const fresh = emptyDoc()
  fresh.settings = store.doc.settings
  store.replaceDoc(fresh, { dirty: true, description: 'Clear all data' })
  saveNow()
  toast('All data deleted')
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
      body: `It contains ${doc.customers.length} customer(s) and ${doc.upgrades.length} upgrade(s). It will replace all current data, on every device.`,
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

/** Upload the data the previous version of the app left in this browser. */
export async function uploadLegacyData(): Promise<void> {
  const doc = readLegacyDoc()
  if (!doc) return
  if (hasData()) {
    const ok = await confirm({
      title: 'Replace your data?',
      body: 'The data from the previous version replaces what is in the database now.',
      confirmLabel: 'Replace',
      danger: true,
    })
    if (!ok) return
  }
  useTracker
    .getState()
    .replaceDoc(doc, { dirty: true, description: 'Upload data from the previous version' })
  saveNow()
  forgetLegacyDoc()
  toast.success('Data uploaded', {
    description: `${doc.customers.length} customer(s) and ${doc.upgrades.length} upgrade(s).`,
  })
}

export async function confirmSignOut(): Promise<void> {
  const status = useTracker.getState().sync.status
  const unsent = status === 'offline' || status === 'error'
  const ok = await confirm({
    title: 'Sign out?',
    body: unsent
      ? 'Some changes have not reached the database yet (offline or an error). Signing out now removes them from this browser.'
      : 'The offline copy of your data is removed from this browser. Sign in again to see it.',
    confirmLabel: 'Sign out',
    danger: unsent,
  })
  if (ok) await signOutAndClear()
}
