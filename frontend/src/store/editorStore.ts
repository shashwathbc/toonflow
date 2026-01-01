import { create } from 'zustand';
import { BrushCategory, BrushConfig, DEFAULT_BRUSH_CONFIG, getBrushById, BRUSH_PRESETS } from '@/config/brushRegistry';

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
}

export const useEditorStore = create<EditorState>((set, get) => ({
    // Defaults
    activeCategory: 'pen',
    activeBrushId: 'g-pen',

    // Brush Settings Map
    brushSettings: {},

    setActiveCategory: (category) => set({ activeCategory: category }),

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
            // Ideally pick the last used brush for this category
        } else {
            set({ activeTool: tool });
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
}));
