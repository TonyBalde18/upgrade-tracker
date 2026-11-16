import { useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '@/lib/model/types'
import { imageFromDataTransfer, LogoError, processLogo } from '@/lib/images/logo'
import { Button } from '@/components/ui/Button'
import { CustomerAvatar } from '@/components/ui/misc'
import { cn } from '@/components/ui/cn'

/** Upload, drop or paste (Ctrl+V) a logo. It is shrunk to 128 px and stored in the private data file. */
export function LogoField({
  customer,
  onChange,
}: {
  customer: Customer
  onChange: (logo: string | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const use = async (file: File | null | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const logo = await processLogo(file)
      onChange(logo)
      toast.success('Logo updated', {
        description: `${Math.round((logo.length * 3) / 4 / 1024)} KB, stored in your private data file.`,
      })
    } catch (e) {
      toast.error('Could not use this image', {
        description: e instanceof LogoError ? e.message : 'Try a PNG or JPEG file.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Customer logo: click Upload, drop an image here, or paste with Ctrl+V"
      onPaste={(e) => {
        const f = imageFromDataTransfer(e.clipboardData)
        if (f) {
          e.preventDefault()
          void use(f)
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void use(imageFromDataTransfer(e.dataTransfer))
      }}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-dashed p-3 transition-colors focus:border-accent focus:outline-none',
        over ? 'border-accent bg-accent-soft' : 'border-border-strong',
      )}
    >
      <CustomerAvatar
        name={customer.name}
        shortName={customer.shortName}
        color={customer.color}
        logo={customer.logo}
        size={56}
      />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs text-muted">
          Drop an image here, paste it (click here, then Ctrl+V) or upload a file. It is resized to
          128 px.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}{' '}
            {customer.logo ? 'Replace' : 'Upload'}
          </Button>
          {customer.logo && (
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          void use(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
