import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTracker } from '@/store/tracker'
import { knownReleases, releaseLogoOf } from '@/lib/releases'
import { ImageDropField } from '@/components/ui/ImageDropField'
import { ReleaseIcon } from '@/components/ui/Release'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/** A logo per ServiceNow release, shown next to release names everywhere in the app. */
export function ReleasesSection() {
  const doc = useTracker((s) => s.doc)
  const setReleaseLogo = useTracker((s) => s.setReleaseLogo)
  const [added, setAdded] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const releases = useMemo(() => {
    const list = knownReleases(doc)
    const lower = new Set(list.map((n) => n.toLowerCase()))
    return [...list, ...added.filter((n) => !lower.has(n.toLowerCase()))]
  }, [doc, added])

  const add = () => {
    const name = draft.trim().replace(/\s+/g, ' ')
    if (!name) return
    setAdded((a) => [...a, name])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Tip: a square badge reads best at this size. If you only have a wide banner, crop it to the
        badge first (Windows: Snipping Tool, then paste here with Ctrl+V).
      </p>
      <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {releases.map((name) => {
          const has = Boolean(releaseLogoOf(doc.settings, name))
          return (
            <li key={name}>
              <ImageDropField
                compact
                ariaLabel={`Logo of the ${name} release`}
                hasImage={has}
                hint=""
                onChange={(logo) => setReleaseLogo(name, logo)}
                preview={
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    {has ? (
                      <ReleaseIcon family={name} size={40} />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[22%] border border-dashed border-border-strong font-heading text-sm font-bold text-subtle">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate font-medium">{name}</span>
                  </span>
                }
              />
            </li>
          )
        })}
      </ul>
      <div className="flex max-w-md items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Another release, e.g. a future family"
          aria-label="Release name"
        />
        <Button onClick={add} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  )
}
