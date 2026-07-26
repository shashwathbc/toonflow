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
  return JSON.parse(
    JSON.stringify({ version: PROJECT_VERSION, pages, timelineOrder }),
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
  const GAP = 80
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
  const res = await fetch(dataUrl)
  const blob = await res.blob()
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
