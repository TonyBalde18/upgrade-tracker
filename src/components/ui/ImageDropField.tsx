import { useRef, useState, type ReactNode } from 'react'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { imageFromDataTransfer, LogoError, processLogo } from '@/lib/images/logo'
import { Button } from './Button'
import { cn } from './cn'

/**
 * Upload, drop or paste (Ctrl+V) an image. It is shrunk to 128 px and handed back as a
 * small raster data URL (stored in your private data, never in the code).
 */
export function ImageDropField({
  preview,
  hasImage,
  onChange,
  ariaLabel,
  hint = 'Drop an image here, paste it (click here, then Ctrl+V) or upload a file. It is resized to 128 px.',
  compact = false,
}: {
  preview: ReactNode
  hasImage: boolean
  onChange: (image: string | undefined) => void
  ariaLabel: string
  hint?: string
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const use = async (file: File | null | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const image = await processLogo(file)
      onChange(image)
      toast.success('Logo updated', {
        description: `${Math.round((image.length * 3) / 4 / 1024)} KB, stored in your private data.`,
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
      aria-label={`${ariaLabel}: click Upload, drop an image here, or paste with Ctrl+V`}
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
        'flex items-center gap-4 rounded-xl border border-dashed transition-colors focus:border-accent focus:outline-none',
        compact ? 'p-2' : 'p-3',
        over ? 'border-accent bg-accent-soft' : 'border-border-strong',
      )}
    >
      {preview}
      <div className={cn('flex flex-1 gap-2', compact ? 'items-center' : 'flex-col')}>
        {hint && <p className={cn('text-xs text-muted', compact && 'flex-1')}>{hint}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}{' '}
            {hasImage ? 'Replace' : 'Upload'}
          </Button>
          {hasImage && (
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          void use(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
