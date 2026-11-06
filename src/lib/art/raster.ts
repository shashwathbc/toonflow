// Client-side raster operations for the Art Studio.
//
// All of this runs in the browser on a <canvas>, so there is no server round
// trip and no vendor dependency — these features work today, in full.

import type { ArtFilterId } from '@/types/art'

/** CSS filter string for each preset. Applied both live and at export. */
export function filterCss(filter: ArtFilterId | undefined): string {
  switch (filter) {
    case 'grayscale':
      return 'grayscale(1)'
    case 'sepia':
      return 'sepia(0.85)'
    case 'invert':
      return 'invert(1)'
    case 'saturate':
      return 'saturate(1.7)'
    case 'contrast':
      return 'contrast(1.35)'
    case 'blur':
      return 'blur(3px)'
    case 'anime':
      // Flat, punchy cel look: lift contrast and saturation, crush the midtones
      // slightly so shading reads as bands rather than a smooth gradient.
      return 'saturate(1.5) contrast(1.25) brightness(1.05)'
    default:
      return 'none'
  }
}

export interface LoadedImage {
  image: HTMLImageElement
  width: number
  height: number
}

/**
 * Load an image for canvas work. `crossOrigin` is required for anything hosted
 * on Firebase Storage: without it the canvas is tainted and toBlob() throws a
 * SecurityError, which is exactly what breaks export.
 */
export function loadImage(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    if (!src.startsWith('data:') && !src.startsWith('blob:')) image.crossOrigin = 'anonymous'
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Could not load that image'))
    image.src = src
  })
}

/**
 * Remove a flat background by flood-filling inward from the edges.
 *
 * This is the honest scope of a client-side tool: it handles the common case —
 * a design exported on a solid or near-solid backdrop — reliably and instantly.
 * It is NOT subject segmentation, and it says so in the UI rather than pretending
 * to be a matting model.
 *
 * `tolerance` is the per-channel distance (0–255) treated as "the same colour".
 */
export async function removeFlatBackground(src: string, tolerance = 32): Promise<string> {
  const { image, width, height } = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(0, 0, width, height)
  const pixels = data.data

  const at = (x: number, y: number) => (y * width + x) * 4
  // Sample the four corners and treat their average as the background colour;
  // one corner alone is easily fooled by a vignette or a signature.
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
  const target = [0, 1, 2].map(
    (channel) => corners.reduce((sum, index) => sum + pixels[index + channel], 0) / corners.length,
  )

  const matches = (index: number) =>
    Math.abs(pixels[index] - target[0]) <= tolerance &&
    Math.abs(pixels[index + 1] - target[1]) <= tolerance &&
    Math.abs(pixels[index + 2] - target[2]) <= tolerance

  // Iterative flood fill with an explicit stack — a recursive one blows the call
  // stack on anything larger than a thumbnail.
  const visited = new Uint8Array(width * height)
  const stack: number[] = []
  for (let x = 0; x < width; x++) {
    stack.push(x, 0, x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    stack.push(0, y, width - 1, y)
  }

  while (stack.length > 0) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const flat = y * width + x
    if (visited[flat]) continue
    const index = flat * 4
    if (!matches(index)) continue
    visited[flat] = 1
    pixels[index + 3] = 0 // transparent
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }

  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Crop to a rectangle expressed in source-pixel coordinates. */
export async function cropImage(
  src: string,
  rect: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const { image } = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rect.width))
  canvas.height = Math.max(1, Math.round(rect.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/** Resize, preserving aspect if only one dimension is given. */
export async function resizeImage(src: string, maxWidth: number, maxHeight?: number): Promise<string> {
  const { image, width, height } = await loadImage(src)
  const scale = Math.min(maxWidth / width, (maxHeight ?? Infinity) / height, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/** Promise wrapper around canvas.toBlob. */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export the canvas'))),
      type,
      quality,
    )
  })
}
