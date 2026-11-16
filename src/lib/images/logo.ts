/**
 * Turns any image the user picks or pastes (PNG, JPEG, WebP, GIF, SVG…) into a small
 * raster data URL: fitted inside 128×128, transparent background, WebP when the
 * browser supports it (else PNG). SVGs are rasterised, so no SVG markup is ever stored.
 */
export const LOGO_MAX_PX = 128
const MAX_INPUT_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_CHARS = 150_000

export class LogoError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new LogoError('This file could not be read as an image.'))
    img.src = url
  })
}

/** Size that fits inside max×max, keeping the aspect ratio. */
export function fitSize(w: number, h: number, max = LOGO_MAX_PX): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: max, h: max }
  const scale = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

export async function processLogo(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/'))
    throw new LogoError('Please choose an image file (PNG, JPEG, WebP or SVG).')
  if (file.size > MAX_INPUT_BYTES) throw new LogoError('The image is larger than 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // SVGs without a size report 0: draw them at the maximum size
    const { w, h } = fitSize(img.naturalWidth || LOGO_MAX_PX, img.naturalHeight || LOGO_MAX_PX)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new LogoError('Your browser cannot process images here.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    let out = canvas.toDataURL('image/webp', 0.9)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png')
    if (out.length > MAX_OUTPUT_CHARS) out = canvas.toDataURL('image/jpeg', 0.85)
    if (out.length > MAX_OUTPUT_CHARS)
      throw new LogoError('The logo is still too large after resizing.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** First image found in a paste or drop. */
export function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return Array.from(dt.files ?? []).find((f) => f.type.startsWith('image/')) ?? null
}
