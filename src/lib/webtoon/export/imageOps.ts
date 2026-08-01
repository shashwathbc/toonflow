// Client-side image plumbing shared by every episode-export format: fetch panel
// bytes, decode them, re-encode to a target codec, and stream a long webtoon
// strip into fixed-size platform slices.
//
// All panel bytes are pulled through the same-origin image proxy (`/api/img`)
// for Storage URLs, so the fetch is never blocked by CORS or a stale pre-CORS
// cached copy, and canvases drawn from them are never tainted. That is the whole
// reason exports can run purely in the browser.

import { isStorageUrl, proxyImageUrl } from '@/lib/utils/imageProxy'

export function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'image/gif':
      return 'gif'
    default:
      return 'img'
  }
}

function guessMimeFromUrl(url: string): string {
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.avif')) return 'image/avif'
  if (clean.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export interface FetchedPanel {
  blob: Blob
  bytes: Uint8Array
  mime: string
  ext: string
}

/** Fetch a single panel's raw bytes. Throws with a readable message on failure. */
export async function fetchPanel(url: string): Promise<FetchedPanel> {
  // Storage images go through the same-origin proxy so the fetch isn't blocked
  // by CORS (or a stale pre-CORS cached copy). Other URLs are fetched directly.
  const target = isStorageUrl(url) ? proxyImageUrl(url) : url
  let res: Response
  try {
    res = await fetch(target)
  } catch {
    throw new Error('Could not reach an image (network or CORS blocked).')
  }
  if (!res.ok) throw new Error(`An image failed to download (${res.status}).`)
  const blob = await res.blob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mime = blob.type || guessMimeFromUrl(url)
  return { blob, bytes, mime, ext: extFromMime(mime) }
}

export interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  /** Release the underlying bitmap / object URL. Always call when done. */
  close: () => void
}

/** Decode a panel blob into something drawable, preferring the fast ImageBitmap path. */
export async function decodePanel(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // Fall through to the <img> path (e.g. Safari refusing a codec via bitmap).
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('An image could not be decoded.'))
      el.src = url
    })
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality))
}

/** Codecs that carry alpha; everything else gets a white matte so it isn't black. */
function isTransparent(mime: string): boolean {
  return mime === 'image/png' || mime === 'image/webp' || mime === 'image/avif'
}

export interface EncodeOptions {
  mime: string
  /** Cap output width in px (keeps aspect). Omit to keep native size. */
  maxWidth?: number
  /** 0..1 for lossy codecs. */
  quality?: number
}

/** Re-encode a decoded panel to `opts.mime`, optionally downscaling. */
export async function encodePanel(dec: Decoded, opts: EncodeOptions): Promise<Blob> {
  const scale = opts.maxWidth ? Math.min(1, opts.maxWidth / dec.width) : 1
  const w = Math.max(1, Math.round(dec.width * scale))
  const h = Math.max(1, Math.round(dec.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
  if (!isTransparent(opts.mime)) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(dec.source, 0, 0, w, h)
  const blob = await canvasToBlob(canvas, opts.mime, opts.quality)
  if (!blob) throw new Error(`This browser can't encode ${opts.mime}.`)
  return blob
}

const probeCache = new Map<string, Promise<boolean>>()

/**
 * Whether this browser can actually encode `mime` from a canvas. PNG/JPEG are
 * universal; WebP and (especially) AVIF encoding vary, so we probe a 2×2 canvas
 * once and cache the answer. Browsers that don't support a codec silently return
 * a PNG blob, so we also confirm the returned type matches.
 */
export function canEncode(mime: string): Promise<boolean> {
  if (mime === 'image/png' || mime === 'image/jpeg') return Promise.resolve(true)
  let cached = probeCache.get(mime)
  if (!cached) {
    cached = (async () => {
      try {
        const c = document.createElement('canvas')
        c.width = 2
        c.height = 2
        const blob = await canvasToBlob(c, mime, 0.8)
        return !!blob && blob.type === mime
      } catch {
        return false
      }
    })()
    probeCache.set(mime, cached)
  }
  return cached
}

export interface SliceOptions {
  /** Output width every slice is normalized to. */
  width: number
  /** Max slice height before cutting to the next image. */
  maxHeight: number
  mime: string
  quality?: number
}

function paintMatte(ctx: CanvasRenderingContext2D, w: number, h: number, mime: string) {
  if (isTransparent(mime)) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
}

/**
 * Stream panels (in order) into fixed-width, capped-height vertical slices — the
 * shape WEBTOON and Tapas want for upload. Panels are scaled to `width`, laid end
 * to end, and cut every `maxHeight` px (a panel can straddle a cut, exactly like
 * dedicated slicing tools). Only one segment canvas is alive at a time, so a very
 * long episode never trips the browser's max-canvas-size limit.
 *
 * `loaders` yields each panel's blob on demand (URL fetch or stage render), so
 * this works for both the reader and the editor without knowing the origin.
 */
export async function sliceVertical(
  loaders: Array<() => Promise<Blob>>,
  opts: SliceOptions,
  onProgress?: (fetched: number, total: number) => void
): Promise<Blob[]> {
  const { width, maxHeight, mime, quality } = opts
  const out: Blob[] = []

  let seg = document.createElement('canvas')
  seg.width = width
  seg.height = maxHeight
  let ctx = seg.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
  paintMatte(ctx, width, maxHeight, mime)
  let cursor = 0

  const flush = async (usedHeight: number) => {
    if (usedHeight <= 0) return
    const trimmed = document.createElement('canvas')
    trimmed.width = width
    trimmed.height = usedHeight
    const tctx = trimmed.getContext('2d')
    if (!tctx) throw new Error('Canvas 2D is unavailable in this browser.')
    paintMatte(tctx, width, usedHeight, mime)
    tctx.drawImage(seg, 0, 0)
    const blob = await canvasToBlob(trimmed, mime, quality)
    if (blob) out.push(blob)
    seg = document.createElement('canvas')
    seg.width = width
    seg.height = maxHeight
    ctx = seg.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
    paintMatte(ctx, width, maxHeight, mime)
    cursor = 0
  }

  for (let i = 0; i < loaders.length; i++) {
    const blob = await loaders[i]()
    const dec = await decodePanel(blob)
    try {
      const scale = width / dec.width
      const scaledH = Math.max(1, Math.round(dec.height * scale))
      let drawn = 0 // scaled px of this panel already placed
      while (drawn < scaledH) {
        const room = maxHeight - cursor
        const chunk = Math.min(room, scaledH - drawn)
        // Copy the corresponding source-space band, scaled into the segment.
        const srcY = drawn / scale
        const srcH = chunk / scale
        ctx.drawImage(dec.source, 0, srcY, dec.width, srcH, 0, cursor, width, chunk)
        cursor += chunk
        drawn += chunk
        if (cursor >= maxHeight) await flush(maxHeight)
      }
    } finally {
      dec.close()
    }
    onProgress?.(i + 1, loaders.length)
  }
  await flush(cursor)
  return out
}
