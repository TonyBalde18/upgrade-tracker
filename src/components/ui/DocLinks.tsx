import { useState } from 'react'
import { ExternalLink, FileText, Plus, Trash2 } from 'lucide-react'
import type { DocLink } from '@/lib/model/types'
import { newId } from '@/lib/id'
import { Button } from './Button'
import { Input } from './Input'
import { cn } from './cn'

/** Only http(s) links open (never javascript: or data:). */
function safeHref(u: string): string | null {
  const s = u.trim()
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null
}

/** Read-only list of document links. */
export function DocLinkList({ links, empty }: { links: DocLink[]; empty?: string }) {
  if (links.length === 0) return empty ? <p className="text-xs text-subtle">{empty}</p> : null
  return (
    <ul className="flex flex-col gap-1">
      {links.map((l) => {
        const href = safeHref(l.url)
        return (
          <li key={l.id} className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0 text-subtle" />
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="min-w-0 truncate text-accent-text hover:underline"
              >
                {l.name || href}
              </a>
            ) : (
              <span className="min-w-0 truncate">{l.name || l.url}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Named links to documents kept elsewhere (SharePoint...): runbooks, smoke-test
 * evidence. Only the link is stored, never the file.
 */
export function DocLinksEditor({
  links,
  onChange,
  readOnly,
  placeholder = 'Runbook, smoke-test evidence…',
}: {
  links: DocLink[]
  onChange: (links: DocLink[], what: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const valid = !!safeHref(url)

  if (readOnly) return <DocLinkList links={links} empty="No documents linked." />

  const add = () => {
    if (!valid) return
    const n = name.trim() || url.trim()
    onChange([...links, { id: newId('doc'), name: n, url: url.trim() }], `link document "${n}"`)
    setName('')
    setUrl('')
  }

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && <p className="text-xs text-subtle">No documents linked yet.</p>}
      <ul className="flex flex-col gap-1">
        {links.map((l) => {
          const href = safeHref(l.url)
          return (
            <li
              key={l.id}
              className="group flex min-w-0 items-center gap-2 rounded-lg border border-border px-2 py-1"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <input
                key={l.name}
                defaultValue={l.name}
                aria-label="Document name"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== l.name)
                    onChange(
                      links.map((x) => (x.id === l.id ? { ...x, name: v } : x)),
                      `rename document "${v}"`,
                    )
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="min-w-0 flex-1 truncate bg-transparent text-sm outline-none"
              />
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-1 text-subtle hover:text-accent-text"
                  aria-label={`Open ${l.name}`}
                  title={href}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange(
                    links.filter((x) => x.id !== l.id),
                    `remove document "${l.name}"`,
                  )
                }
                className="cursor-pointer p-1 text-subtle opacity-60 hover:text-danger group-hover:opacity-100"
                aria-label={`Remove ${l.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
      <form
        className="flex flex-col gap-1.5 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          aria-label="New document name"
          className="h-8 text-xs sm:w-44"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…sharepoint.com/…"
          aria-label="New document link"
          className={cn('h-8 flex-1 text-xs', url && !valid && 'border-danger')}
        />
        <Button size="sm" type="submit" disabled={!valid}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </form>
    </div>
  )
}
