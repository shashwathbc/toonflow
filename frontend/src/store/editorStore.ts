import { create } from 'zustand';

interface EditorState {
    // Main Tool State
    activeTool: string;
    setActiveTool: (tool: string) => void;

    // Sub Tool State
    activeSubTool: string;
    setActiveSubTool: (subTool: string) => void;

    // Per-tool settings: { 'g-pen': { size: 5, opacity: 100 } }
    toolSettings: Record<string, Record<string, any>>;
    setToolSetting: (subToolId: string, property: string, value: any) => void;

    // Global Visual State (Synced with active sub-tool)
    brushSize: number;
    setBrushSize: (size: number) => void;

    opacity: number;
    setOpacity: (opacity: number) => void;

    color: string;
    setColor: (color: string) => void;

    scale: number;
    setScale: (scale: number) => void;

    // Webtoon / Page State
    pages: number[]; // Ordered list of page IDs (1, 2, 3...)
    setPages: (pages: number[]) => void;

    pageImages: Record<number, string>; // Snapshot URL for each page
    setPageImage: (pageId: number, imageUrl: string) => void;

    activePage: number | null;
    setActivePage: (pageId: number | null) => void;

    // Edit State
    isEditMode: boolean;
    setIsEditMode: (isEdit: boolean) => void;

    // Undo/Redo Signal Triggers
    undoTrigger: number;
    redoTrigger: number;
    triggerUndo: () => void;
    triggerRedo: () => void;

    // Color Swatches
    swatches: string[];
    addSwatch: (color: string) => void;

    // Optional: storage for fabric instances if needed externally
    canvasInstances: Record<number, any>;
}

export const useEditorStore = create<EditorState>((set) => ({
    activeTool: 'brush',
    setActiveTool: (tool) => set({ activeTool: tool }),

    activeSubTool: 'g-pen', // Default
    setActiveSubTool: (subTool) => set({ activeSubTool: subTool }),

    toolSettings: {},
    setToolSetting: (subToolId, prop, val) => set((state) => ({
        toolSettings: {
            ...state.toolSettings,
            [subToolId]: {
                ...(state.toolSettings[subToolId] || {}),
                [prop]: val
            }
        }
    })),

    brushSize: 5,
    setBrushSize: (size) => set({ brushSize: size }),

    opacity: 100,
    setOpacity: (opacity) => set({ opacity }),

    color: '#000000',
    setColor: (color) => set({ color }),

    scale: 1,
    setScale: (scale) => set({ scale }),

    // Default to 1 page
    pages: [1, 2, 3],
    setPages: (pages) => set({ pages }),

    pageImages: {},
    setPageImage: (id, url) => set((state) => ({ pageImages: { ...state.pageImages, [id]: url } })),

    activePage: 1,
    setActivePage: (id) => set({ activePage: id }),

    isEditMode: true,
    setIsEditMode: (val) => set({ isEditMode: val }),

    // Color Swatches
    swatches: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00'],
    addSwatch: (color) => set((state) => ({ swatches: [color, ...state.swatches] })),

    undoTrigger: 0,
    redoTrigger: 0,
    triggerUndo: () => set((state) => ({ undoTrigger: state.undoTrigger + 1 })),
    triggerRedo: () => set((state) => ({ redoTrigger: state.redoTrigger + 1 })),

    canvasInstances: {},
}));
