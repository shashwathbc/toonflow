// Layer state for the Art Studio canvas.
//
// Same discipline as the video editor store: explicit pushHistory() before each
// mutation, so undo maps to user-visible actions rather than React renders.
import { create } from 'zustand'
import type {
  ArtDocument,
  ArtDocumentSurface,
  ArtFilterId,
  ArtLayer,
  ArtLayerKind,
  PrintPlacement,
  ProductType,
} from '@/types/art'

export const DEFAULT_CANVAS = { width: 2048, height: 2048 }

/**
 * A blank canvas opens ON a product, not on an empty rectangle. The Art Studio
 * sells merchandise, so the garment is the context the design is made for — and
 * a creator who wanted a bare canvas is one toggle away from it.
 */
export const DEFAULT_SURFACE: ArtDocumentSurface = {
  mode: 'product',
  productType: 'tshirt',
  colorId: 'black',
  placement: 'front',
  showPrintArea: true,
}

interface Snapshot {
  layers: ArtLayer[]
  background: string | null
}

interface ArtEditorState {
  artworkId: string | null
  width: number
  height: number
  background: string | null
  layers: ArtLayer[]
  selectedLayerId: string | null
  surface: ArtDocumentSurface
  dirty: boolean
  undoStack: Snapshot[]
  redoStack: Snapshot[]

  setSurfaceMode: (mode: ArtDocumentSurface['mode']) => void
  setProductType: (productType: ProductType, colorId: string, placement: PrintPlacement) => void
  setProductColor: (colorId: string) => void
  setPlacement: (placement: PrintPlacement) => void
  togglePrintArea: () => void

  load: (artworkId: string, document: ArtDocument | null) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void

  addLayer: (layer: Omit<ArtLayer, 'id'>) => string
  updateLayer: (layerId: string, patch: Partial<ArtLayer>) => void
  removeLayer: (layerId: string) => void
  duplicateLayer: (layerId: string) => void
  reorderLayer: (layerId: string, direction: -1 | 1) => void
  select: (layerId: string | null) => void

  setCanvas: (width: number, height: number) => void
  setBackground: (background: string | null) => void
  markClean: () => void

  toDocument: () => ArtDocument
}

let counter = 0
const nextId = () => `layer-${Date.now().toString(36)}-${(counter += 1).toString(36)}`

const cloneLayers = (layers: ArtLayer[]) => layers.map((layer) => ({ ...layer }))

export const useArtEditorStore = create<ArtEditorState>((set, get) => ({
  artworkId: null,
  width: DEFAULT_CANVAS.width,
  height: DEFAULT_CANVAS.height,
  background: null,
  layers: [],
  selectedLayerId: null,
  surface: DEFAULT_SURFACE,
  dirty: false,
  undoStack: [],
  redoStack: [],

  // Surface changes are view state, not layer state, so they do NOT push
  // history: undo should step through the creator's drawing, not through them
  // rotating a shirt to look at the back.
  setSurfaceMode: (mode) => set((state) => ({ surface: { ...state.surface, mode }, dirty: true })),
  setProductType: (productType, colorId, placement) =>
    set((state) => ({ surface: { ...state.surface, productType, colorId, placement }, dirty: true })),
  setProductColor: (colorId) => set((state) => ({ surface: { ...state.surface, colorId }, dirty: true })),
  setPlacement: (placement) => set((state) => ({ surface: { ...state.surface, placement }, dirty: true })),
  togglePrintArea: () =>
    set((state) => ({ surface: { ...state.surface, showPrintArea: !state.surface.showPrintArea } })),

  load: (artworkId, document) => {
    set({
      artworkId,
      width: document?.width ?? DEFAULT_CANVAS.width,
      height: document?.height ?? DEFAULT_CANVAS.height,
      background: document?.background ?? null,
      layers: document ? cloneLayers(document.layers) : [],
      selectedLayerId: null,
      // Documents saved before the product surface existed have no `surface`.
      // They were authored as flat artwork, so restore them that way rather
      // than silently reframing someone's finished piece onto a t-shirt.
      surface: document ? (document.surface ?? { ...DEFAULT_SURFACE, mode: 'flat' }) : DEFAULT_SURFACE,
      dirty: false,
      undoStack: [],
      redoStack: [],
    })
  },

  pushHistory: () => {
    const { layers, background, undoStack } = get()
    set({
      undoStack: [...undoStack, { layers: cloneLayers(layers), background }].slice(-60),
      redoStack: [],
    })
  },

  undo: () => {
    const { undoStack, redoStack, layers, background } = get()
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    set({
      layers: previous.layers,
      background: previous.background,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { layers: cloneLayers(layers), background }].slice(-60),
      dirty: true,
    })
  },

  redo: () => {
    const { undoStack, redoStack, layers, background } = get()
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    set({
      layers: next.layers,
      background: next.background,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { layers: cloneLayers(layers), background }].slice(-60),
      dirty: true,
    })
  },

  addLayer: (layer) => {
    get().pushHistory()
    const id = nextId()
    set((state) => ({ layers: [...state.layers, { ...layer, id }], selectedLayerId: id, dirty: true }))
    return id
  },

  updateLayer: (layerId, patch) => {
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
      dirty: true,
    }))
  },

  removeLayer: (layerId) => {
    get().pushHistory()
    set((state) => ({
      layers: state.layers.filter((layer) => layer.id !== layerId),
      selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
      dirty: true,
    }))
  },

  duplicateLayer: (layerId) => {
    const source = get().layers.find((layer) => layer.id === layerId)
    if (!source) return
    get().pushHistory()
    const copy = { ...source, id: nextId(), name: `${source.name} copy`, x: source.x + 24, y: source.y + 24 }
    set((state) => ({ layers: [...state.layers, copy], selectedLayerId: copy.id, dirty: true }))
  },

  reorderLayer: (layerId, direction) => {
    const { layers } = get()
    const index = layers.findIndex((layer) => layer.id === layerId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= layers.length) return
    get().pushHistory()
    const next = [...layers]
    ;[next[index], next[target]] = [next[target], next[index]]
    set({ layers: next, dirty: true })
  },

  select: (layerId) => set({ selectedLayerId: layerId }),
  setCanvas: (width, height) => set({ width, height, dirty: true }),
  setBackground: (background) => {
    get().pushHistory()
    set({ background, dirty: true })
  },
  markClean: () => set({ dirty: false }),

  toDocument: () => {
    const { width, height, background, layers, surface } = get()
    return { version: 1, width, height, background, layers, surface }
  },
}))

export type { ArtLayer, ArtLayerKind, ArtFilterId }
