import { create } from 'zustand'
import { v4 as uuid } from 'uuid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ElementType = 'rect' | 'ellipse' | 'text' | 'image'
export type ToolId = 'select' | 'hand' | 'frame' | 'text' | 'rect' | 'ellipse' | 'ai'
export type PageType =
  | 'webtoon'
  | 'cover'
  | 'character'
  | 'storyboard'
  | 'poster'
  | 'concept'
  | 'thumbnail'
  | 'manga'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  isLocked: boolean
  isHidden: boolean
  name: string
}

export interface ShapeElement extends BaseElement {
  type: 'rect' | 'ellipse'
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  align: 'left' | 'center' | 'right'
  fontStyle: string // 'normal' | 'bold' | 'italic' | 'bold italic'
  lineHeight: number
}

export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
}

export type EditorElement = ShapeElement | TextElement | ImageElement

export interface Page {
  id: string
  name: string
  type: PageType
  x: number
  y: number
  width: number
  height: number
  backgroundColor: string
  isLocked: boolean
  isHidden: boolean
  elements: EditorElement[]
}

export interface Viewport {
  x: number
  y: number
  scale: number
}

/**
 * Serializable snapshot of a canvas project, persisted per-episode to Firestore.
 * Images referenced by elements are Storage URLs (never base64) so the document
 * stays well under the 1 MB limit.
 */
export interface CanvasProject {
  version: number
  pages: Page[]
  timelineOrder: string[]
}

/** Owner + location context so canvas image drops upload to the right Storage path. */
export interface AssetContext {
  uid: string
  webtoonId: string
  episodeId: string
}

export type LeftTab = 'pages' | 'layers' | 'assets' | 'characters' | 'ai'
export type RightTab = 'properties' | 'assistant' | 'export'

// ---------------------------------------------------------------------------
// Page presets — every page type ships production-correct dimensions.
// ---------------------------------------------------------------------------

export const PAGE_PRESETS: Record<
  PageType,
  { label: string; width: number; height: number; color: string; hint: string }
> = {
  webtoon: { label: 'Webtoon Page', width: 800, height: 1280, color: '#FFFFFF', hint: '800 × 1280 · vertical scroll' },
  cover: { label: 'Cover', width: 800, height: 1200, color: '#0B0B12', hint: '800 × 1200 · series art' },
  character: { label: 'Character Sheet', width: 1200, height: 1500, color: '#12121A', hint: '1200 × 1500 · reference' },
  storyboard: { label: 'Storyboard', width: 1600, height: 900, color: '#101014', hint: '1600 × 900 · 16:9 beats' },
  poster: { label: 'Instagram Poster', width: 1080, height: 1350, color: '#0E0E14', hint: '1080 × 1350 · 4:5 social' },
  concept: { label: 'Concept Art', width: 1600, height: 1000, color: '#0D0D12', hint: '1600 × 1000 · exploration' },
  thumbnail: { label: 'Thumbnail', width: 1200, height: 630, color: '#111', hint: '1200 × 630 · listing card' },
  manga: { label: 'Manga Page', width: 1200, height: 1700, color: '#FFFFFF', hint: '1200 × 1700 · B4 spread' },
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface HistorySnapshot {
  pages: Page[]
  timelineOrder: string[]
}

export type GridStyle = 'dots' | 'lines' | 'none'

interface EditorState {
  pages: Page[]
  selectedPageId: string | null
  selectedElementIds: string[]
  viewport: Viewport
  viewportSize: { width: number; height: number }
  timelineOrder: string[]
  activeTool: ToolId

  // View options
  gridStyle: GridStyle
  showSafeZone: boolean
  snapEnabled: boolean

  // Export/publish: while true the Workspace renders every page (culling off)
  // so off-screen pages can be rasterized.
  exporting: boolean
  // Upload target for canvas image drops (set by the editor once an episode binds).
  assetCtx: AssetContext | null

  // Panel layout (resizable + collapsible)
  leftTab: LeftTab
  rightTab: RightTab
  leftOpen: boolean
  rightOpen: boolean
  timelineOpen: boolean
  leftWidth: number
  rightWidth: number
  timelineHeight: number

  undoStack: HistorySnapshot[]
  redoStack: HistorySnapshot[]

  // Viewport / tools
  setViewport: (v: Viewport) => void
  setViewportSize: (width: number, height: number) => void
  setActiveTool: (t: ToolId) => void

  // View options
  setGridStyle: (g: GridStyle) => void
  toggleSafeZone: () => void
  toggleSnap: () => void

  // Export / persistence
  setExporting: (v: boolean) => void
  setAssetCtx: (ctx: AssetContext | null) => void
  loadProject: (project: CanvasProject | null) => void

  // Camera (animated navigation)
  animateViewport: (target: Viewport) => void
  setZoom: (scale: number, animate?: boolean) => void
  zoomIn: () => void
  zoomOut: () => void
  fitAll: (animate?: boolean) => void
  actualSize: () => void
  fitWidth: () => void
  fitPage: (id: string) => void
  fitSelection: () => void

  // Panels
  setLeftTab: (t: LeftTab) => void
  setRightTab: (t: RightTab) => void
  toggleLeft: () => void
  toggleRight: () => void
  toggleTimeline: () => void
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  setTimelineHeight: (h: number) => void

  // Selection
  selectPage: (id: string | null) => void
  selectElements: (ids: string[], additive?: boolean) => void
  clearSelection: () => void
  selectAllInPage: () => void

  // Pages
  activePageId: () => string | null
  addPage: (data?: Partial<Page>, type?: PageType) => string
  updatePage: (id: string, data: Partial<Page>, commit?: boolean) => void
  removePage: (id: string) => void
  duplicatePage: (id: string) => void
  reorderPages: (order: string[]) => void
  mergeEpisode: () => void

  // Elements
  addElement: (pageId: string, data: Partial<EditorElement> & { type: ElementType }) => string
  updateElement: (pageId: string, elementId: string, data: Partial<EditorElement>, commit?: boolean) => void
  updateSelected: (data: Partial<EditorElement>, commit?: boolean) => void
  removeSelected: () => void
  duplicateSelected: () => void
  moveZ: (pageId: string, elementId: string, dir: 'front' | 'back' | 'forward' | 'backward') => void
  nudgeSelected: (dx: number, dy: number) => void

  // History
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

const INITIAL_VIEWPORT: Viewport = { x: 120, y: 80, scale: 0.6 }

const elementDefaults = (type: ElementType): EditorElement => {
  const base = {
    id: uuid(),
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    isLocked: false,
    isHidden: false,
  }
  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        width: 320,
        height: 60,
        name: 'Text',
        text: 'Double-click to edit',
        fontSize: 40,
        fontFamily: 'Inter',
        fill: '#111111',
        align: 'left',
        fontStyle: 'normal',
        lineHeight: 1.2,
      }
    case 'image':
      return { ...base, type: 'image', width: 400, height: 400, name: 'Image', src: '' }
    case 'ellipse':
      return {
        ...base, type: 'ellipse', width: 240, height: 240, name: 'Ellipse',
        fill: '#4C9AFF', stroke: '#000000', strokeWidth: 0, cornerRadius: 0,
      }
    case 'rect':
    default:
      return {
        ...base, type: 'rect', width: 320, height: 200, name: 'Rectangle',
        fill: '#4C9AFF', stroke: '#000000', strokeWidth: 0, cornerRadius: 8,
      }
  }
}

// --- camera math (module scope, pure) --------------------------------------
export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16]
const ZOOM_MIN = 0.02
const ZOOM_MAX = 16
const clampZoom = (s: number) => Math.max(ZOOM_MIN, Math.min(s, ZOOM_MAX))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

let viewportRaf: number | null = null
const cancelViewportAnim = () => {
  if (viewportRaf != null) {
    cancelAnimationFrame(viewportRaf)
    viewportRaf = null
  }
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number }

const pagesBBox = (pages: Page[]): BBox | null => {
  if (!pages.length) return null
  return {
    minX: Math.min(...pages.map((p) => p.x)),
    minY: Math.min(...pages.map((p) => p.y)),
    maxX: Math.max(...pages.map((p) => p.x + p.width)),
    maxY: Math.max(...pages.map((p) => p.y + p.height)),
  }
}

const fitViewport = (
  b: BBox,
  size: { width: number; height: number },
  pad = 0.82,
  mode: 'contain' | 'width' = 'contain',
): Viewport => {
  const bw = Math.max(1, b.maxX - b.minX)
  const bh = Math.max(1, b.maxY - b.minY)
  const scale = clampZoom(
    mode === 'width' ? (size.width * pad) / bw : Math.min((size.width * pad) / bw, (size.height * pad) / bh),
  )
  return {
    x: (size.width - bw * scale) / 2 - b.minX * scale,
    y: mode === 'width'
      ? (size.height * (1 - pad)) / 2 - b.minY * scale
      : (size.height - bh * scale) / 2 - b.minY * scale,
    scale,
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  pages: [],
  selectedPageId: null,
  selectedElementIds: [],
  viewport: INITIAL_VIEWPORT,
  viewportSize: { width: 0, height: 0 },
  timelineOrder: [],
  activeTool: 'select',

  gridStyle: 'dots',
  showSafeZone: false,
  snapEnabled: true,

  exporting: false,
  assetCtx: null,

  leftTab: 'pages',
  rightTab: 'properties',
  leftOpen: true,
  rightOpen: true,
  timelineOpen: true,
  leftWidth: 264,
  rightWidth: 288,
  timelineHeight: 168,

  undoStack: [],
  redoStack: [],

  setViewport: (viewport) => {
    cancelViewportAnim()
    set({ viewport })
  },
  setViewportSize: (width, height) => set({ viewportSize: { width, height } }),
  setActiveTool: (activeTool) => set({ activeTool }),

  setGridStyle: (gridStyle) => set({ gridStyle }),
  toggleSafeZone: () => set((s) => ({ showSafeZone: !s.showSafeZone })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setExporting: (exporting) => set({ exporting }),
  setAssetCtx: (assetCtx) => set({ assetCtx }),

  // Replace the whole canvas with a persisted project (or clear it). Resets
  // selection and history — the caller is switching episodes, not editing.
  loadProject: (project) => {
    cancelViewportAnim()
    set({
      pages: project ? structuredClone(project.pages) : [],
      timelineOrder: project ? [...project.timelineOrder] : [],
      selectedPageId: null,
      selectedElementIds: [],
      undoStack: [],
      redoStack: [],
    })
  },

  animateViewport: (target) => {
    cancelViewportAnim()
    const start = get().viewport
    const dur = 260
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      const e = easeOutCubic(t)
      set({
        viewport: {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          scale: start.scale + (target.scale - start.scale) * e,
        },
      })
      if (t < 1) viewportRaf = requestAnimationFrame(tick)
      else {
        viewportRaf = null
        set({ viewport: target })
      }
    }
    viewportRaf = requestAnimationFrame(tick)
  },

  setZoom: (scale, animate = true) => {
    const { viewport, viewportSize } = get()
    const s = clampZoom(scale)
    const cx = viewportSize.width / 2 || 0
    const cy = viewportSize.height / 2 || 0
    const worldX = (cx - viewport.x) / viewport.scale
    const worldY = (cy - viewport.y) / viewport.scale
    const target = { x: cx - worldX * s, y: cy - worldY * s, scale: s }
    if (animate) get().animateViewport(target)
    else set({ viewport: target })
  },

  zoomIn: () => {
    const cur = get().viewport.scale
    get().setZoom(ZOOM_STEPS.find((z) => z > cur + 1e-4) ?? ZOOM_MAX)
  },
  zoomOut: () => {
    const cur = get().viewport.scale
    get().setZoom([...ZOOM_STEPS].reverse().find((z) => z < cur - 1e-4) ?? ZOOM_MIN)
  },

  fitAll: (animate = true) => {
    const { pages, viewportSize } = get()
    const b = pagesBBox(pages)
    if (!b || !viewportSize.width) return
    const t = fitViewport(b, viewportSize)
    if (animate) get().animateViewport(t)
    else set({ viewport: t })
  },

  actualSize: () => get().setZoom(1),

  fitWidth: () => {
    const { pages, viewportSize } = get()
    const b = pagesBBox(pages)
    if (!b || !viewportSize.width) return
    get().animateViewport(fitViewport(b, viewportSize, 0.92, 'width'))
  },

  fitPage: (id) => {
    const { pages, viewportSize } = get()
    const p = pages.find((x) => x.id === id)
    if (!p || !viewportSize.width) return
    get().animateViewport(
      fitViewport({ minX: p.x, minY: p.y, maxX: p.x + p.width, maxY: p.y + p.height }, viewportSize, 0.9),
    )
  },

  fitSelection: () => {
    const { pages, viewportSize, selectedElementIds, selectedPageId } = get()
    if (!viewportSize.width) return
    let b: BBox | null = null
    if (selectedElementIds.length) {
      const ids = new Set(selectedElementIds)
      for (const p of pages)
        for (const el of p.elements)
          if (ids.has(el.id)) {
            const x = p.x + el.x
            const y = p.y + el.y
            b = b
              ? { minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x + el.width), maxY: Math.max(b.maxY, y + el.height) }
              : { minX: x, minY: y, maxX: x + el.width, maxY: y + el.height }
          }
    } else if (selectedPageId) {
      const p = pages.find((x) => x.id === selectedPageId)
      if (p) b = { minX: p.x, minY: p.y, maxX: p.x + p.width, maxY: p.y + p.height }
    }
    if (!b) {
      get().fitAll()
      return
    }
    get().animateViewport(fitViewport(b, viewportSize, 0.6))
  },

  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
  setLeftWidth: (w) => set({ leftWidth: Math.max(200, Math.min(w, 460)) }),
  setRightWidth: (w) => set({ rightWidth: Math.max(220, Math.min(w, 460)) }),
  setTimelineHeight: (h) => set({ timelineHeight: Math.max(96, Math.min(h, 360)) }),

  selectPage: (id) => set({ selectedPageId: id, selectedElementIds: [] }),

  selectElements: (ids, additive = false) =>
    set((s) => ({
      selectedElementIds: additive
        ? Array.from(new Set([...s.selectedElementIds, ...ids]))
        : ids,
    })),

  clearSelection: () => set({ selectedElementIds: [] }),

  selectAllInPage: () => {
    const pageId = get().activePageId()
    const page = get().pages.find((p) => p.id === pageId)
    if (!page) return
    set({ selectedElementIds: page.elements.filter((e) => !e.isLocked && !e.isHidden).map((e) => e.id) })
  },

  activePageId: () => {
    const { selectedPageId, selectedElementIds, pages } = get()
    if (selectedElementIds.length > 0) {
      const owner = pages.find((p) => p.elements.some((e) => e.id === selectedElementIds[0]))
      if (owner) return owner.id
    }
    return selectedPageId ?? pages[0]?.id ?? null
  },

  addPage: (data = {}, type = 'webtoon') => {
    get().pushHistory()
    const preset = PAGE_PRESETS[type]
    const pages = get().pages
    // Lay new pages to the right of the current spread so the canvas grows sideways.
    const lastRight = pages.reduce((max, p) => Math.max(max, p.x + p.width), 0)
    const newPage: Page = {
      id: uuid(),
      name: `${preset.label} ${pages.filter((p) => p.type === type).length + 1}`,
      type,
      x: pages.length ? lastRight + 120 : 0,
      y: 0,
      width: preset.width,
      height: preset.height,
      backgroundColor: preset.color,
      isLocked: false,
      isHidden: false,
      elements: [],
      ...data,
    }
    set((s) => ({
      pages: [...s.pages, newPage],
      timelineOrder: [...s.timelineOrder, newPage.id],
      selectedPageId: newPage.id,
      selectedElementIds: [],
    }))
    return newPage.id
  },

  updatePage: (id, data, commit = true) => {
    if (commit) get().pushHistory()
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...data } : p)) }))
  },

  removePage: (id) => {
    get().pushHistory()
    set((s) => ({
      pages: s.pages.filter((p) => p.id !== id),
      timelineOrder: s.timelineOrder.filter((pid) => pid !== id),
      selectedPageId: s.selectedPageId === id ? null : s.selectedPageId,
      selectedElementIds: [],
    }))
  },

  duplicatePage: (id) => {
    get().pushHistory()
    const src = get().pages.find((p) => p.id === id)
    if (!src) return
    const clone: Page = {
      ...src,
      id: uuid(),
      name: `${src.name} copy`,
      x: src.x + src.width + 120,
      elements: src.elements.map((e) => ({ ...e, id: uuid() })),
    }
    set((s) => {
      const idx = s.timelineOrder.indexOf(id)
      const order = [...s.timelineOrder]
      order.splice(idx + 1, 0, clone.id)
      return { pages: [...s.pages, clone], timelineOrder: order, selectedPageId: clone.id, selectedElementIds: [] }
    })
  },

  reorderPages: (order) => {
    get().pushHistory()
    set({ timelineOrder: order })
  },

  // Stack every page vertically in reading order — the "Merge Episode" preview.
  mergeEpisode: () => {
    get().pushHistory()
    const { pages, timelineOrder } = get()
    let cursorY = 0
    const positioned = new Map<string, { x: number; y: number }>()
    timelineOrder.forEach((pid) => {
      const p = pages.find((pg) => pg.id === pid)
      if (!p) return
      positioned.set(pid, { x: 0, y: cursorY })
      cursorY += p.height
    })
    set({
      pages: pages.map((p) => (positioned.has(p.id) ? { ...p, ...positioned.get(p.id)! } : p)),
      selectedElementIds: [],
    })
  },

  addElement: (pageId, data) => {
    get().pushHistory()
    const el = { ...elementDefaults(data.type), ...data } as EditorElement
    set((s) => ({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, elements: [...p.elements, el] } : p)),
      selectedElementIds: [el.id],
      selectedPageId: pageId,
    }))
    return el.id
  },

  updateElement: (pageId, elementId, data, commit = false) => {
    if (commit) get().pushHistory()
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p
        return {
          ...p,
          elements: p.elements.map((el) => (el.id === elementId ? ({ ...el, ...data } as EditorElement) : el)),
        }
      }),
    }))
  },

  updateSelected: (data, commit = true) => {
    if (commit) get().pushHistory()
    const ids = new Set(get().selectedElementIds)
    if (ids.size === 0) return
    set((s) => ({
      pages: s.pages.map((p) => ({
        ...p,
        elements: p.elements.map((el) => (ids.has(el.id) ? ({ ...el, ...data } as EditorElement) : el)),
      })),
    }))
  },

  removeSelected: () => {
    const ids = new Set(get().selectedElementIds)
    if (ids.size === 0) return
    get().pushHistory()
    set((s) => ({
      pages: s.pages.map((p) => ({ ...p, elements: p.elements.filter((el) => !ids.has(el.id)) })),
      selectedElementIds: [],
    }))
  },

  duplicateSelected: () => {
    const ids = new Set(get().selectedElementIds)
    if (ids.size === 0) return
    get().pushHistory()
    const newIds: string[] = []
    set((s) => ({
      pages: s.pages.map((p) => {
        const clones = p.elements
          .filter((el) => ids.has(el.id))
          .map((el) => {
            const c = { ...el, id: uuid(), x: el.x + 24, y: el.y + 24 } as EditorElement
            newIds.push(c.id)
            return c
          })
        return clones.length ? { ...p, elements: [...p.elements, ...clones] } : p
      }),
    }))
    set({ selectedElementIds: newIds })
  },

  moveZ: (pageId, elementId, dir) => {
    get().pushHistory()
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p
        const els = [...p.elements]
        const i = els.findIndex((e) => e.id === elementId)
        if (i < 0) return p
        const [el] = els.splice(i, 1)
        if (dir === 'front') els.push(el)
        else if (dir === 'back') els.unshift(el)
        else if (dir === 'forward') els.splice(Math.min(i + 1, els.length), 0, el)
        else els.splice(Math.max(i - 1, 0), 0, el)
        return { ...p, elements: els }
      }),
    }))
  },

  nudgeSelected: (dx, dy) => {
    const ids = new Set(get().selectedElementIds)
    if (ids.size === 0) return
    set((s) => ({
      pages: s.pages.map((p) => ({
        ...p,
        elements: p.elements.map((el) => (ids.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
      })),
    }))
  },

  pushHistory: () => {
    const { pages, timelineOrder, undoStack } = get()
    const snap: HistorySnapshot = { pages: structuredClone(pages), timelineOrder: [...timelineOrder] }
    set({ undoStack: [...undoStack, snap].slice(-80), redoStack: [] })
  },

  undo: () => {
    const { undoStack, pages, timelineOrder, redoStack } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    set({
      pages: prev.pages,
      timelineOrder: prev.timelineOrder,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { pages: structuredClone(pages), timelineOrder: [...timelineOrder] }].slice(-80),
      selectedElementIds: [],
    })
  },

  redo: () => {
    const { redoStack, pages, timelineOrder, undoStack } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    set({
      pages: next.pages,
      timelineOrder: next.timelineOrder,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { pages: structuredClone(pages), timelineOrder: [...timelineOrder] }].slice(-80),
      selectedElementIds: [],
    })
  },
}))
