import { Command } from 'cmdk'
import { Dialog as D } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Building2,
  CloudDownload,
  Database,
  Download,
  FileUp,
  ListTodo,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Redo2,
  Rocket,
  Save,
  Search,
  Sun,
  Undo2,
} from 'lucide-react'
import { NAV } from './nav'
import { useUi } from '@/store/ui'
import { redo, undo, useTracker } from '@/store/tracker'
import { pull, saveNow } from '@/store/persistence'
import { exportBackup, importBackup, loadDemoData } from './actions'
import { Kbd } from '@/components/ui/misc'

const itemCls =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-text aria-selected:bg-surface-2 data-[selected=true]:bg-surface-2'
const groupCls =
  '[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3'

/** Mounted only while the palette is open, so it starts from the requested query each time. */
function SearchInput({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <Command.Input
      autoFocus
      value={value}
      onValueChange={setValue}
      placeholder="Type a command, customer, upgrade or step…"
      className="h-13 flex-1 bg-transparent py-4 text-sm text-text outline-none placeholder:text-subtle"
    />
  )
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const initialQuery = useUi((s) => s.paletteQuery)
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const toggleSidebar = useUi((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const customers = useTracker((s) => s.doc.customers)
  const upgrades = useTracker((s) => s.doc.upgrades)
  const updateSettings = useTracker((s) => s.updateSettings)

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const steps = useMemo(
    () =>
      upgrades.flatMap((u) =>
        u.tasks.map((t) => ({
          key: `${u.id}:${t.id}`,
          upgradeId: u.id,
          taskId: t.id,
          label: t.name,
          customer: customerById.get(u.customerId)?.name ?? 'Unknown customer',
          family: u.family,
        })),
      ),
    [upgrades, customerById],
  )

  const run = (fn: () => void) => {
    setOpen(false)
    // let the dialog close before running (focus returns correctly)
    requestAnimationFrame(fn)
  }

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-[14vh] z-50 w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift"
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              >
                <D.Title className="sr-only">Command palette</D.Title>
                <D.Description className="sr-only">Search and run commands</D.Description>
                <Command loop label="Command palette" defaultValue="">
                  <div className="flex items-center gap-3 border-b border-border px-4">
                    <Search className="h-4 w-4 text-subtle" />
                    <SearchInput initial={initialQuery} />
                    <Kbd>Esc</Kbd>
                  </div>
                  <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                    <Command.Empty className="px-3 py-8 text-center text-sm text-subtle">
                      Nothing found.
                    </Command.Empty>

                    <Command.Group heading="Actions" className={groupCls}>
                      <Command.Item
                        className={itemCls}
                        onSelect={() => run(() => setNewUpgradeOpen(true))}
                      >
                        <Plus className="h-4 w-4 text-accent-text" /> New upgrade
                        <Kbd className="ml-auto">N</Kbd>
                      </Command.Item>
                      <Command.Item className={itemCls} onSelect={() => run(saveNow)}>
                        <Save className="h-4 w-4" /> Save now
                        <Kbd className="ml-auto">Ctrl S</Kbd>
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['github', 'sync', 'refresh', 'reload']}
                        onSelect={() => run(() => void pull({ silent: false }))}
                      >
                        <CloudDownload className="h-4 w-4" /> Pull latest from GitHub
                      </Command.Item>
                      <Command.Item className={itemCls} onSelect={() => run(undo)}>
                        <Undo2 className="h-4 w-4" /> Undo
                        <Kbd className="ml-auto">Ctrl Z</Kbd>
                      </Command.Item>
                      <Command.Item className={itemCls} onSelect={() => run(redo)}>
                        <Redo2 className="h-4 w-4" /> Redo
                        <Kbd className="ml-auto">Ctrl Shift Z</Kbd>
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['theme', 'dark']}
                        onSelect={() =>
                          run(() =>
                            updateSettings({ theme: 'dark' }, 'Theme → dark', { history: false }),
                          )
                        }
                      >
                        <Moon className="h-4 w-4" /> Dark theme
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['theme', 'light']}
                        onSelect={() =>
                          run(() =>
                            updateSettings({ theme: 'light' }, 'Theme → light', { history: false }),
                          )
                        }
                      >
                        <Sun className="h-4 w-4" /> Light theme
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['theme', 'system']}
                        onSelect={() =>
                          run(() =>
                            updateSettings({ theme: 'system' }, 'Theme → system', {
                              history: false,
                            }),
                          )
                        }
                      >
                        <Monitor className="h-4 w-4" /> System theme
                      </Command.Item>
                      <Command.Item className={itemCls} onSelect={() => run(toggleSidebar)}>
                        <PanelLeft className="h-4 w-4" /> Toggle sidebar
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['backup']}
                        onSelect={() => run(exportBackup)}
                      >
                        <Download className="h-4 w-4" /> Export JSON backup
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['backup', 'restore']}
                        onSelect={() => run(() => void importBackup())}
                      >
                        <FileUp className="h-4 w-4" /> Import JSON backup
                      </Command.Item>
                      <Command.Item
                        className={itemCls}
                        keywords={['demo', 'sample']}
                        onSelect={() => run(() => void loadDemoData())}
                      >
                        <Database className="h-4 w-4" /> Load demo data
                      </Command.Item>
                    </Command.Group>

                    <Command.Group heading="Go to" className={groupCls}>
                      {NAV.map((n) => (
                        <Command.Item
                          key={n.path}
                          className={itemCls}
                          value={`go ${n.label}`}
                          onSelect={() => run(() => navigate(n.path))}
                        >
                          <n.icon className="h-4 w-4" /> {n.label}
                          {n.goKey && (
                            <span className="ml-auto flex gap-0.5">
                              <Kbd>G</Kbd>
                              <Kbd>{n.goKey.toUpperCase()}</Kbd>
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>

                    {customers.length > 0 && (
                      <Command.Group heading="Customers" className={groupCls}>
                        {customers.map((c) => (
                          <Command.Item
                            key={c.id}
                            className={itemCls}
                            value={`customer ${c.name} ${c.shortName} ${c.id}`}
                            onSelect={() => run(() => navigate(`/customers/${c.id}`))}
                          >
                            <Building2 className="h-4 w-4" style={{ color: c.color }} />
                            <span className="truncate">{c.name}</span>
                            <span className="ml-auto text-xs text-subtle">{c.shortName}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {upgrades.length > 0 && (
                      <Command.Group heading="Upgrades" className={groupCls}>
                        {upgrades.map((u) => {
                          const c = customerById.get(u.customerId)
                          return (
                            <Command.Item
                              key={u.id}
                              className={itemCls}
                              value={`upgrade ${c?.name ?? ''} ${u.fromFamily} ${u.family} ${u.cycle} ${u.id}`}
                              onSelect={() => run(() => navigate(`/upgrades/${u.id}`))}
                            >
                              <Rocket className="h-4 w-4" style={{ color: c?.color }} />
                              <span className="truncate">
                                {c?.name ?? 'Unknown'} · {u.fromFamily} → {u.family}
                              </span>
                              <span className="ml-auto text-xs text-subtle">{u.cycle}</span>
                            </Command.Item>
                          )
                        })}
                      </Command.Group>
                    )}

                    {steps.length > 0 && (
                      <Command.Group heading="Steps" className={groupCls}>
                        {steps.map((s) => (
                          <Command.Item
                            key={s.key}
                            className={itemCls}
                            value={`step ${s.label} ${s.customer} ${s.key}`}
                            onSelect={() =>
                              run(() => navigate(`/upgrades/${s.upgradeId}?task=${s.taskId}`))
                            }
                          >
                            <ListTodo className="h-4 w-4 text-subtle" />
                            <span className="truncate">{s.label}</span>
                            <span className="ml-auto shrink-0 text-xs text-subtle">
                              {s.customer}
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                  </Command.List>
                </Command>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  )
}
