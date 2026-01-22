import { create } from 'zustand';
import { BrushCategory, BrushConfig, DEFAULT_BRUSH_CONFIG, getBrushById, BRUSH_PRESETS } from '@/config/brushRegistry';

// --- LAYER SYSTEM TYPES ---
export type LayerType = 'pen' | 'pencil' | 'paint' | 'watercolor' | 'airbrush' | 'image' | 'text' | 'vector' | 'ai';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';

export interface Layer {
    id: string;
    name: string;
    type: LayerType;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: BlendMode;
    // Optional: children for groups? For now flat list.
}

interface EditorState {
    // --- BRUSH ENGINE STATE ---
    activeCategory: BrushCategory;
    setActiveCategory: (category: BrushCategory) => void;

    activeBrushId: string;
    setActiveBrushId: (brushId: string) => void;

    // Runtime overrides for brushes (id -> partial config)
    brushSettings: Record<string, Partial<BrushConfig>>;
    setBrushSetting: (brushId: string, property: keyof BrushConfig | 'pressure.size' | 'pressure.opacity', value: any) => void;
    getStartBrushConfig: (brushId: string) => BrushConfig;

    // Global visual overrides (linked to UI sliders)
    brushSize: number;
    setBrushSize: (size: number) => void;
    opacity: number;
    setOpacity: (opacity: number) => void;
    color: string;
    setColor: (color: string) => void;

    // --- LEGACY / GENERAL STATE ---
    activeTool: string; // Deprecated but kept for compatibility with UI selectors (e.g. 'hand', 'select')
    setActiveTool: (tool: string) => void;

    scale: number;
    setScale: (scale: number) => void;

    // Webtoon / Page State
    pages: number[];
    setPages: (pages: number[]) => void;
    pageImages: Record<number, string>;
    setPageImage: (pageId: number, imageUrl: string) => void;
    activePage: number | null;
    setActivePage: (pageId: number | null) => void;

    // Edit State
    isEditMode: boolean;
    setIsEditMode: (isEdit: boolean) => void;

    // Undo/Redo
    undoTrigger: number;
    redoTrigger: number;
    triggerUndo: () => void;
    triggerRedo: () => void;

    // Color Swatches
    swatches: string[];
    addSwatch: (color: string) => void;

    // --- LAYER SYSTEM STATE ---
    layers: Layer[];
    activeLayerId: string | null;

    addLayer: (type: LayerType) => void;
    removeLayer: (id: string) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    setActiveLayer: (id: string) => void;
    reorderLayers: (fromIndex: number, toIndex: number) => void;

    // Helper to auto-switch layer based on tool
    autoSelectLayerForTool: (toolCategory: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    // Defaults
    activeCategory: 'pen',
    activeBrushId: 'g-pen',

    // Brush Settings Map
    brushSettings: {},

    setActiveCategory: (category) => {
        set({ activeCategory: category });
        // Auto-switch layer logic can be triggered here if needed
        get().autoSelectLayerForTool(category);
    },

    setActiveBrushId: (brushId) => {
        // When switching bush, we might want to sync global sliders to that brush's saved preference
        const config = get().getStartBrushConfig(brushId);
        set({
            activeBrushId: brushId,
            brushSize: config.size,
            opacity: config.opacity,
            // category might need update if selected from Favorites
            activeCategory: config.category
        });

        get().autoSelectLayerForTool(config.category);
    },

    setBrushSetting: (brushId, prop, val) => set((state) => {
        const currentSettings = state.brushSettings[brushId] || {};

        // Handle nested pressure props
        if (prop.startsWith('pressure.')) {
            const pressureKey = prop.split('.')[1] as keyof BrushConfig['pressure'];
            const pressure = {
                ...(currentSettings.pressure || getBrushById(brushId).pressure),
                [pressureKey]: val
            };
            return {
                brushSettings: {
                    ...state.brushSettings,
                    [brushId]: { ...currentSettings, pressure }
                }
            };
        }

        return {
            brushSettings: {
                ...state.brushSettings,
                [brushId]: { ...currentSettings, [prop]: val }
            }
        };
    }),

    getStartBrushConfig: (brushId) => {
        const base = getBrushById(brushId);
        const overrides = get().brushSettings[brushId] || {};
        return { ...base, ...overrides };
    },

    // Global Visuals
    brushSize: 5,
    setBrushSize: (size) => {
        set({ brushSize: size });
        // Auto-save to current brush
        const { activeBrushId } = get();
        get().setBrushSetting(activeBrushId, 'size', size);
    },

    opacity: 100,
    setOpacity: (opacity) => {
        set({ opacity });
        const { activeBrushId } = get();
        get().setBrushSetting(activeBrushId, 'opacity', opacity);
    },

    color: '#000000',
    setColor: (color) => set({ color }),

    // Legacy / Tool Handling
    activeTool: 'brush',
    setActiveTool: (tool) => {
        // Map generic UI tools to categories
        const categoryMap: Record<string, BrushCategory> = {
            'brush': 'paint',
            'pen': 'pen',
            'pencil': 'pencil',
            'eraser': 'eraser',
            'airbrush': 'airbrush',
            'decoration': 'decoration'
        };

        if (categoryMap[tool]) {
            set({ activeCategory: categoryMap[tool], activeTool: tool });
            get().autoSelectLayerForTool(categoryMap[tool]);
        } else {
            // Clear activeCategory so generic tools don't conflict with brush tools in UI
            set({ activeTool: tool, activeCategory: null as any });
        }
    },

    scale: 1,
    setScale: (scale) => set({ scale }),

    pages: [1, 2, 3],
    setPages: (pages) => set({ pages }),

    pageImages: {},
    setPageImage: (id, url) => set((state) => ({ pageImages: { ...state.pageImages, [id]: url } })),

    activePage: 1,
    setActivePage: (id) => set({ activePage: id }),

    isEditMode: true,
    setIsEditMode: (val) => set({ isEditMode: val }),

    swatches: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'],
    addSwatch: (color) => set((state) => ({ swatches: [color, ...state.swatches] })),

    undoTrigger: 0,
    redoTrigger: 0,
    triggerUndo: () => set((state) => ({ undoTrigger: state.undoTrigger + 1 })),
    triggerRedo: () => set((state) => ({ redoTrigger: state.redoTrigger + 1 })),

    // --- LAYER SYSTEM IMPLEMENTATION ---
    layers: [
        { id: 'layer-pen', name: 'Pen Layer', type: 'pen', visible: true, locked: false, opacity: 1, blendMode: 'normal' },
        { id: 'layer-paint', name: 'Paint Layer', type: 'paint', visible: true, locked: false, opacity: 1, blendMode: 'normal' },
        { id: 'layer-sketch', name: 'Sketch Layer', type: 'pencil', visible: true, locked: false, opacity: 0.5, blendMode: 'multiply' },
        { id: 'layer-bg', name: 'Paper', type: 'image', visible: true, locked: true, opacity: 1, blendMode: 'normal' },
    ],
    activeLayerId: 'layer-pen',

    addLayer: (type) => set((state) => {
        const newLayer: Layer = {
            id: `layer-${Date.now()}`,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Layer`,
            type,
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'normal'
        };
        return {
            layers: [newLayer, ...state.layers],
            activeLayerId: newLayer.id
        };
    }),

    removeLayer: (id) => set((state) => {
        if (state.layers.length <= 1) return state; // Don't delete last layer
        const newLayers = state.layers.filter(l => l.id !== id);
        return {
            layers: newLayers,
            activeLayerId: state.activeLayerId === id ? newLayers[0].id : state.activeLayerId
        };
    }),

    updateLayer: (id, updates) => set((state) => ({
        layers: state.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    })),

    setActiveLayer: (id) => set({ activeLayerId: id }),

    reorderLayers: (fromIndex, toIndex) => set((state) => {
        const newLayers = [...state.layers];
        const [movedLayer] = newLayers.splice(fromIndex, 1);
        newLayers.splice(toIndex, 0, movedLayer);
        return { layers: newLayers };
    }),

    autoSelectLayerForTool: (toolCategory) => {
        // Logic: Find the first unlocked, visible layer of the matching type.
        // If not found, do nothing (or maybe auto-create?)
        const state = get();
        // Map tool category to layer type
        const typeMap: Record<string, LayerType> = {
            'pen': 'pen',
            'paint': 'paint',
            'pencil': 'pen', // Map pencil to pen layer or separate? Let's say pen for now or generic
            'watercolor': 'watercolor',
            'airbrush': 'airbrush',
            'eraser': 'pen' // Eraser doesn't really have a layer type preference, usually erases active
        };

        const targetType = typeMap[toolCategory];
        if (!targetType) return;

        // Try to find an existing layer of this type that is active or at least exists
        const currentLayer = state.layers.find(l => l.id === state.activeLayerId);
        if (currentLayer && currentLayer.type === targetType && !currentLayer.locked) {
            return; // Already on a good layer
        }

        const bestLayer = state.layers.find(l => l.type === targetType && !l.locked && l.visible);
        if (bestLayer) {
            set({ activeLayerId: bestLayer.id });
        }
    }
}));
