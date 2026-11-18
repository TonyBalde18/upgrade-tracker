import { ReleasePath } from '@/components/ui/Release'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  Building2,
  ClipboardPaste,
  ExternalLink,
  Lock,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { deleteCustomer } from '@/store/upgradeActions'
import type { Customer, EnvKey } from '@/lib/model/types'
import { customerColors } from '@/theme/brand'
import { formatDay, todayIn } from '@/lib/dates'
import { activeUpgradeFor, ENV_LABEL } from '@/lib/upgrade/logic'
import { progressOf } from '@/lib/template/schedule'
import { newId } from '@/lib/id'
import { Button } from '@/components/ui/Button'
import { Card, CustomerAvatar, CustomerChip, SectionTitle } from '@/components/ui/misc'
import { LogoField } from './LogoField'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Switch } from '@/components/ui/Switch'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Tooltip } from '@/components/ui/Tooltip'
import { confirm } from '@/components/ui/confirm'
import { cn } from '@/components/ui/cn'
import { safeUrl } from '@/features/plan/TaskTable'

type Filter = 'active' | 'all' | 'inactive'

/** Text field that saves on blur (Enter also saves). */
function BlurInput({
  value,
  onSave,
  ...rest
}: { value: string; onSave: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onBlur'
>) {
  return (
    <Input
      key={value}
      defaultValue={value}
      onBlur={(e) => e.target.value.trim() !== value && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      {...rest}
    />
  )
}

function ConsultantsEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {value.map((v) => (
            <motion.span
              key={v}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-2 pr-1 pl-2.5 text-xs"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="cursor-pointer rounded-full p-0.5 text-subtle hover:text-text"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {value.length === 0 && <span className="text-xs text-subtle">No consultants yet.</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add consultant…"
          aria-label="Add consultant"
        />
        <Button onClick={add} disabled={!draft.trim()} aria-label="Add consultant">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CustomerEditor({ customer }: { customer: Customer }) {
  const doc = useTracker((s) => s.doc)
  const upsert = useTracker((s) => s.upsertCustomer)
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const navigate = useNavigate()
  const { settings } = doc
  const today = todayIn(settings.displayTimeZone)
  const save = (patch: Partial<Customer>) => upsert({ ...customer, ...patch })
  const upgrades = useMemo(
    () =>
      doc.upgrades
        .filter((u) => u.customerId === customer.id)
        .sort((a, b) => b.windows.prod.start.localeCompare(a.windows.prod.start)),
    [doc.upgrades, customer.id],
  )
  const active = activeUpgradeFor(customer.id, doc)

  return (
    <motion.div
      key={customer.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="flex flex-col gap-5"
    >
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar
              name={customer.name}
              shortName={customer.shortName}
              color={customer.color}
              logo={customer.logo}
              size={44}
            />
            <div className="min-w-0">
              <div className="eyebrow">Customer</div>
              <h2 className="truncate text-xl font-bold">{customer.name}</h2>
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <Switch
              checked={customer.active}
              onCheckedChange={(active) => save({ active })}
              label="Active customer"
            />
            {customer.active ? 'Active' : 'Inactive'}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="c-name">
            <BlurInput
              id="c-name"
              value={customer.name}
              onSave={(name) => name && save({ name })}
            />
          </Field>
          <Field label="Short name" htmlFor="c-short" hint="Used on chips and calendar titles.">
            <BlurInput
              id="c-short"
              value={customer.shortName}
              onSave={(shortName) => save({ shortName })}
            />
          </Field>
          <Field label="ServiceNow contact" htmlFor="c-sn">
            <BlurInput
              id="c-sn"
              value={customer.snContact}
              onSave={(snContact) => save({ snContact })}
              placeholder="ServiceNow-side contact"
            />
          </Field>
          <Field label="Logo" className="md:col-span-2">
            <LogoField
              customer={customer}
              onChange={(logo) => {
                const next = { ...customer, logo }
                if (!logo) delete next.logo
                upsert(next)
              }}
            />
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Customer colour">
              {customerColors.map((col) => (
                <button
                  key={col}
                  type="button"
                  role="radio"
                  aria-checked={customer.color === col}
                  aria-label={col}
                  onClick={() => save({ color: col })}
                  className={cn(
                    'h-7 w-7 cursor-pointer rounded-md border-2 transition-transform hover:scale-110',
                    customer.color === col ? 'border-text' : 'border-transparent',
                  )}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </Field>
          {(['dev', 'uat', 'prod'] as EnvKey[]).map((env) => {
            const url = safeUrl(customer.instances[env])
            return (
              <Field key={env} label={`${ENV_LABEL[env]} instance`} htmlFor={`c-${env}`}>
                <div className="flex gap-2">
                  <BlurInput
                    id={`c-${env}`}
                    value={customer.instances[env]}
                    onSave={(v) => save({ instances: { ...customer.instances, [env]: v } })}
                    placeholder="https://….service-now.com"
                  />
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-subtle hover:text-accent-text"
                      aria-label={`Open ${ENV_LABEL[env]} instance`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </Field>
            )
          })}
          <Field label="Consultants" className="md:col-span-2">
            <ConsultantsEditor
              value={customer.consultants}
              onChange={(consultants) => save({ consultants })}
            />
          </Field>
          <Field label="Notes" htmlFor="c-notes" className="md:col-span-2">
            <Textarea
              id="c-notes"
              key={customer.notes}
              defaultValue={customer.notes}
              onBlur={(e) => e.target.value !== customer.notes && save({ notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (upgrades.length > 0) {
                toast.error('This customer has upgrades', {
                  description: 'Delete its upgrades first, or mark the customer inactive.',
                })
                return
              }
              if (
                await confirm({
                  title: `Delete ${customer.name}?`,
                  confirmLabel: 'Delete customer',
                  danger: true,
                })
              ) {
                deleteCustomer(customer.id)
                navigate('/customers')
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete customer
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Upgrade history</h3>
          <Tooltip
            content={
              active
                ? `Active upgrade: ${active.fromFamily} → ${active.family}. One upgrade at a time.`
                : ''
            }
          >
            <span>
              <Button
                size="sm"
                variant="primary"
                disabled={!!active}
                onClick={() => setNewUpgradeOpen(true, customer.id)}
              >
                {active ? <Lock className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />} New
                upgrade
              </Button>
            </span>
          </Tooltip>
        </div>
        {upgrades.length === 0 && <p className="text-sm text-subtle">No upgrades yet.</p>}
        <ol className="flex flex-col gap-2">
          {upgrades.map((u, i) => {
            const past = u.windows.prod.start.slice(0, 10) < today
            return (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/upgrades/${u.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border p-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <ProgressRing
                    value={progressOf(u.tasks, settings.taskStatuses)}
                    size={40}
                    stroke={4}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <ReleasePath from={u.fromFamily} to={u.family} size={18} />
                      <span className="text-xs font-normal text-subtle">· {u.cycle}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {past ? 'Past' : 'Planned'} · PROD{' '}
                      {formatDay(u.windows.prod.start.slice(0, 10))}
                    </div>
                  </div>
                  <StatusBadge
                    status={settings.scheduleStatuses.find((s) => s.id === u.scheduleStatus)}
                    size="sm"
                  />
                </Link>
              </motion.li>
            )
          })}
        </ol>
      </Card>
    </motion.div>
  )
}

export default function CustomersPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const doc = useTracker((s) => s.doc)
  const addCustomers = useTracker((s) => s.addCustomers)
  const upsert = useTracker((s) => s.upsertCustomer)
  const { customers, upgrades, settings } = doc
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [text, setText] = useState('')

  const list = customers
    .filter((c) => (filter === 'all' ? true : filter === 'active' ? c.active : !c.active))
    .filter(
      (c) =>
        !query ||
        `${c.name} ${c.shortName} ${c.snContact} ${c.consultants.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const selected = customers.find((c) => c.id === customerId)

  const submitPaste = () => {
    const n = addCustomers(text.split(/\r?\n/))
    toast.success(n ? `${n} customer(s) added` : 'Nothing new to add')
    setText('')
    setPasteOpen(false)
  }
  const addOne = () => {
    const c: Customer = {
      id: newId('cus'),
      name: 'New customer',
      shortName: 'NEW',
      color: customerColors[customers.length % customerColors.length] ?? '#94A3B8',
      snContact: '',
      consultants: [],
      instances: { dev: '', uat: '', prod: '' },
      notes: '',
      active: true,
    }
    upsert(c)
    navigate(`/customers/${c.id}`)
    setTimeout(() => document.querySelector<HTMLInputElement>('#c-name')?.select(), 120)
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden p-6">
      <SectionTitle
        eyebrow="Directory"
        title="Customers"
        actions={
          <>
            <Button onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4" /> Paste names
            </Button>
            <Button variant="primary" onClick={addOne}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </>
        }
      />
      {customers.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No customers yet"
          body="Paste your customer names, one per line, to create them in bulk."
          actions={
            <Button variant="primary" onClick={() => setPasteOpen(true)}>
              Paste names
            </Button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-5">
          <div className="flex w-80 shrink-0 flex-col gap-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers…"
                className="pl-9"
                aria-label="Search customers"
              />
            </div>
            <Segmented<Filter>
              ariaLabel="Filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All' },
              ]}
            />
            <ul className="-mr-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-2">
              {list.map((c, i) => {
                const active = activeUpgradeFor(c.id, doc)
                const count = upgrades.filter((u) => u.customerId === c.id).length
                const isSel = c.id === customerId
                return (
                  <motion.li
                    key={c.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.25) }}
                  >
                    <Link
                      to={`/customers/${c.id}`}
                      className={cn(
                        'relative flex flex-col gap-1 rounded-xl border px-3 py-2.5 transition-colors',
                        isSel
                          ? 'border-accent bg-accent-soft'
                          : 'border-transparent hover:border-border hover:bg-surface-2',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <CustomerChip
                          logo={c.logo}
                          color={c.color}
                          label={c.name}
                          className="text-sm font-medium"
                        />
                        <span className="shrink-0 text-[0.7rem] text-subtle">{c.shortName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-subtle">
                        {active ? (
                          <StatusBadge
                            status={settings.scheduleStatuses.find(
                              (s) => s.id === active.scheduleStatus,
                            )}
                            size="sm"
                          />
                        ) : (
                          <span>{count ? `${count} upgrade(s)` : 'No upgrades'}</span>
                        )}
                        {!c.active && <span>· inactive</span>}
                      </div>
                    </Link>
                  </motion.li>
                )
              })}
              {list.length === 0 && (
                <li className="p-4 text-center text-sm text-subtle">No customers match.</li>
              )}
            </ul>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto pr-1 pb-4">
            {selected ? (
              <CustomerEditor customer={selected} />
            ) : (
              <EmptyState
                icon={<Building2 />}
                title="Select a customer"
                body="Pick a customer on the left to edit details and see its upgrade history."
              />
            )}
          </div>
        </div>
      )}

      <Dialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        title="Paste customer names"
        description="One name per line. Duplicates and existing customers are skipped."
        footer={
          <>
            <Button onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitPaste} disabled={!text.trim()}>
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
