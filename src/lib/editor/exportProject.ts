import type Konva from 'konva'
import { useEditorStore, type Page } from '@/store/useEditorStore'

// The live Konva stage is registered here by the Workspace so panels outside
// the canvas (export, thumbnails) can render pages without prop-drilling refs.
let stage: Konva.Stage | null = null
export const registerStage = (s: Konva.Stage | null) => { stage = s }
export const getStage = () => stage

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Render a single page group to a PNG at 2x and download it. */
export function exportPagePng(pageId: string, pageName: string) {
  if (!stage) return false
  const node = stage.findOne('#page-' + pageId)
  if (!node) return false
  const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
  if (!page) return false
  // Clear selection so transformer handles/outlines aren't baked in.
  useEditorStore.getState().clearSelection()
  const url = node.toDataURL({
    x: node.getAbsolutePosition().x,
    y: node.getAbsolutePosition().y,
    width: page.width * stage.scaleX(),
    height: page.height * stage.scaleY(),
    pixelRatio: 2 / stage.scaleX(),
  })
  triggerDownload(url, `${pageName.replace(/[^\w-]+/g, '_')}.png`)
  return true
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

/**
 * Rasterize one page's artboard to an image at `targetWidth` (defaults to 2×).
 * The crop starts at the artboard's top-left so the floating page-name label is
 * excluded. Callers should clear selection / hide the safe-zone first.
 * Requires the page's node to be mounted — set the store `exporting` flag so
 * off-screen pages aren't culled before calling.
 */
export async function exportPageBlob(pageId: string, targetWidth?: number): Promise<Blob | null> {
  if (!stage) return null
  const node = stage.findOne('#page-' + pageId)
  if (!node) return null
  const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
  if (!page) return null
  const scaleX = stage.scaleX()
  const abs = node.getAbsolutePosition()
  const canvas = node.toCanvas({
    x: abs.x,
    y: abs.y,
    width: page.width * scaleX,
    height: page.height * scaleX,
    pixelRatio: (targetWidth ? targetWidth / page.width : 2) / scaleX,
  })
  return canvasToBlob(canvas)
}

/**
 * Merge every page (in reading order, skipping hidden ones) into one tall
 * long-scroll image — the single-file webtoon export. Each page is normalized to
 * `targetWidth` and stacked vertically.
 */
export async function exportMergedStripBlob(order: string[], targetWidth = 1080): Promise<Blob | null> {
  if (!stage) return null
  const state = useEditorStore.getState()
  const pages = order
    .map((id) => state.pages.find((p) => p.id === id))
    .filter((p): p is Page => !!p && !p.isHidden)
  if (!pages.length) return null

  const scaleX = stage.scaleX()
  const slices: HTMLCanvasElement[] = []
  let totalH = 0
  for (const page of pages) {
    const node = stage.findOne('#page-' + page.id)
    if (!node) continue
    const abs = node.getAbsolutePosition()
    const c = node.toCanvas({
      x: abs.x,
      y: abs.y,
      width: page.width * scaleX,
      height: page.height * scaleX,
      pixelRatio: targetWidth / page.width / scaleX,
    })
    slices.push(c)
    totalH += c.height
  }
  if (!slices.length) return null

  // Feathered cross-fade at every seam so the merged strip reads as ONE
  // continuous scroll instead of stacked rectangles: each slice (after the first)
  // overlaps the previous by BLEND px, and its top BLEND px fade in over the
  // slice above, melting the tonal jump between two independently-rendered panels.
  const BLEND = Math.max(0, Math.round(targetWidth * 0.02))
  const stackedH = totalH - BLEND * (slices.length - 1)

  const out = document.createElement('canvas')
  out.width = targetWidth
  out.height = Math.max(1, stackedH)
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  let y = 0
  slices.forEach((c, i) => {
    if (i === 0 || BLEND === 0) {
      ctx.drawImage(c, 0, y)
    } else {
      // Mask the slice's top BLEND rows to a 0→1 vertical alpha ramp so the panel
      // above shows through the seam, then fade to fully opaque below it.
      const tmp = document.createElement('canvas')
      tmp.width = c.width
      tmp.height = c.height
      const tctx = tmp.getContext('2d')
      if (!tctx) {
        ctx.drawImage(c, 0, y)
      } else {
        tctx.drawImage(c, 0, 0)
        tctx.globalCompositeOperation = 'destination-in'
        const g = tctx.createLinearGradient(0, 0, 0, BLEND)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, 'rgba(0,0,0,1)')
        tctx.fillStyle = g
        tctx.fillRect(0, 0, tmp.width, BLEND)
        tctx.fillStyle = 'rgba(0,0,0,1)'
        tctx.fillRect(0, BLEND, tmp.width, tmp.height - BLEND)
        tctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(tmp, 0, y)
      }
    }
    // Next slice starts BLEND px up so it overlaps this one (except after the last).
    y += c.height - (i < slices.length - 1 ? BLEND : 0)
  })
  return canvasToBlob(out)
}

/** Download a blob under a filename (used for the merged-strip export). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Serialize the whole project (pages + reading order) as a .json file. */
export function exportProjectJson(projectName = 'toonflow-project') {
  const { pages, timelineOrder } = useEditorStore.getState()
  const blob = new Blob([JSON.stringify({ version: 1, pages, timelineOrder }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `${projectName}.json`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
