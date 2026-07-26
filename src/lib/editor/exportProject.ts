import type Konva from 'konva'
import { useEditorStore } from '@/store/useEditorStore'

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
