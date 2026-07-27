// ---------------------------------------------------------------------------
// Runtime registry of paint-layer bitmaps.
//
// A paint layer's live pixels live on a mutable <canvas> here — NOT in the
// Zustand store (canvases aren't serialisable and would defeat structuredClone
// history/persistence). The store's PaintElement only holds `src`, a committed
// PNG data URL, which is what gets snapshotted for undo and saved to Firestore.
//
// `reconcile` keeps the live canvas in sync with `src` whenever it changes from
// the outside (undo / redo / loading a project), while the brush engine mutates
// the canvas directly during a stroke and calls `markSrc` on commit so this
// registry doesn't redundantly reload the pixels it just produced.
// ---------------------------------------------------------------------------

interface Entry {
  canvas: HTMLCanvasElement
  src: string
}

const registry = new Map<string, Entry>()

function ensure(id: string, width: number, height: number): Entry {
  let e = registry.get(id)
  if (!e) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    e = { canvas, src: '' }
    registry.set(id, e)
  }
  return e
}

/** Get (creating if needed) the live paint canvas for a layer. */
export function getPaintCanvas(id: string, width: number, height: number): HTMLCanvasElement {
  return ensure(id, width, height).canvas
}

/**
 * Make the live canvas match `src`. Returns a promise when an async image load
 * is needed (so the caller can redraw once it resolves), or void when already
 * in sync / cleared synchronously.
 */
export function reconcilePaintCanvas(
  id: string,
  src: string,
  width: number,
  height: number,
): Promise<void> | void {
  const e = ensure(id, width, height)
  if (e.src === src) return
  e.src = src
  const ctx = e.canvas.getContext('2d')!
  if (!src) {
    ctx.clearRect(0, 0, e.canvas.width, e.canvas.height)
    return
  }
  return new Promise<void>((resolve) => {
    const img = new Image()
    // Storage-hosted bitmaps must load anonymously or the canvas becomes tainted
    // and a later toDataURL() (next stroke's base snapshot / export) would throw.
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, e.canvas.width, e.canvas.height)
      ctx.drawImage(img, 0, 0, e.canvas.width, e.canvas.height)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

/** Record that the live canvas already equals `src` (after we exported it). */
export function markPaintSrc(id: string, src: string) {
  const e = registry.get(id)
  if (e) e.src = src
}

/** Drop a layer's bitmap (e.g. when the element is deleted). */
export function removePaintCanvas(id: string) {
  registry.delete(id)
}
