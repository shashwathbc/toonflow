import {
  useEditorStore,
  type CanvasProject,
  type Page,
  type ImageElement,
} from '@/store/useEditorStore'
import { uploadCanvasAsset } from '@/lib/firebase/storage'
import type { PanelImage } from '@/types'

export const PROJECT_VERSION = 1

/**
 * Snapshot the live store as a Firestore-safe project. The JSON round-trip
 * strips any `undefined`/functions so the document write can never be rejected.
 */
export function serializeProject(): CanvasProject {
  const { pages, timelineOrder } = useEditorStore.getState()
  // Strip inline base64 (data:) sources before persisting. Image drops already
  // upload to Storage, but a raster paint layer holds a live data-URL bitmap in
  // `src` — writing that into the Firestore doc would blow the 1 MB limit and
  // fail the save. Painted pixels are still captured at publish (the stage is
  // rasterized); Storage-backed persistence of raw paint layers is the next
  // step. This guarantees autosave can never be rejected for size.
  const safePages = pages.map((p) => ({
    ...p,
    elements: p.elements.map((el) =>
      'src' in el && typeof el.src === 'string' && el.src.startsWith('data:')
        ? { ...el, src: '' }
        : el,
    ),
  }))
  return JSON.parse(
    JSON.stringify({ version: PROJECT_VERSION, pages: safePages, timelineOrder }),
  ) as CanvasProject
}

/** True when a project actually has drawable pages worth persisting/publishing. */
export function projectHasContent(project: CanvasProject | null | undefined): boolean {
  return !!project && Array.isArray(project.pages) && project.pages.length > 0
}

/**
 * Bootstrap a canvas from an episode's existing flat panel strip: one webtoon
 * page per panel, each holding a single locked full-bleed image. Lets episodes
 * created with the old strip editor open seamlessly in the infinite canvas.
 */
export function migratePanelsToPages(panels: PanelImage[]): CanvasProject {
  // No gap: the panels form one continuous column so the canvas reads as a
  // single long vertical page (matching the merged/published output).
  const GAP = 0
  let cursorY = 0
  const pages: Page[] = []
  const timelineOrder: string[] = []

  panels
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((panel, i) => {
      const width = panel.width || 1080
      const height = panel.height || Math.round(width * 1.4)
      const pageId = crypto.randomUUID()
      const image: ImageElement = {
        id: crypto.randomUUID(),
        type: 'image',
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        opacity: 1,
        isLocked: true,
        isHidden: false,
        name: panel.altText || `Panel ${i + 1}`,
        src: panel.url,
      }
      pages.push({
        id: pageId,
        name: `Scene ${i + 1}`,
        type: 'webtoon',
        x: 0,
        y: cursorY,
        width,
        height,
        backgroundColor: '#FFFFFF',
        isLocked: false,
        isHidden: false,
        elements: [image],
      })
      timelineOrder.push(pageId)
      cursorY += height + GAP
    })

  return { version: PROJECT_VERSION, pages, timelineOrder }
}

/** Convert a data/blob URL into a typed File suitable for Storage upload. */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  let blob: Blob
  if (dataUrl.startsWith('data:')) {
    // Decode the data URL directly — do NOT fetch() it. The app's CSP
    // connect-src (next.config.js) doesn't allow `data:`, so fetch('data:…')
    // throws "Failed to fetch" and breaks every canvas/AI image upload.
    const comma = dataUrl.indexOf(',')
    const header = dataUrl.slice(5, comma) // between "data:" and ","
    const type = header.split(';')[0] || 'image/jpeg'
    const payload = dataUrl.slice(comma + 1)
    if (/;base64/i.test(header)) {
      const bin = atob(payload)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      blob = new Blob([bytes], { type })
    } else {
      blob = new Blob([decodeURIComponent(payload)], { type })
    }
  } else {
    // blob: object URLs must be read via fetch (same-origin).
    const res = await fetch(dataUrl)
    blob = await res.blob()
  }
  const type = blob.type || 'image/jpeg'
  const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const name = /\.[a-z0-9]+$/i.test(filename) ? filename : `${filename}.${ext}`
  return new File([blob], name, { type })
}

/**
 * Upload a canvas image (given as a data URL) to Storage and return its download
 * URL, so the element's `src` is a URL rather than base64. Falls back to the raw
 * data URL only when no upload context is bound (dev / unauthenticated).
 */
export async function uploadCanvasImage(dataUrl: string, name: string): Promise<string> {
  const ctx = useEditorStore.getState().assetCtx
  if (!ctx) return dataUrl
  const file = await dataUrlToFile(dataUrl, name || 'asset')
  return uploadCanvasAsset(ctx.uid, ctx.webtoonId, ctx.episodeId, file, crypto.randomUUID())
}
