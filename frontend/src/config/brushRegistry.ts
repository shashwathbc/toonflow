
import { Pen, Brush, Eraser, SprayCan, Edit3, Sparkles, Highlighter, Quote } from 'lucide-react';

export type BrushCategory = 'pencil' | 'pen' | 'paint' | 'watercolor' | 'airbrush' | 'decoration' | 'eraser';

export interface BrushConfig {
    id: string;
    label: string;
    category: BrushCategory;
    icon?: string; // URL for internal visual preview

    // Core Properties
    size: number;
    opacity: number;        // 0-100
    flow: number;           // 0-100 (Density)
    spacing: number;        // 0-100 (Distance between points)
    hardness: number;       // 0-100 (Edge sharpness)
    stabilization: number;  // 0-100 (Input smoothing)

    // Engine specific
    engine: 'vector' | 'raster';
    baseShape?: 'circle' | 'square' | 'texture';
    textureUrl?: string;    // DataURL or path

    // Pressure Dynamics
    pressure: {
        size: boolean;
        opacity: boolean;
        flow: boolean;
    };

    defaults: {
        size: number;
        opacity: number;
    };
}

export const DEFAULT_BRUSH_CONFIG: BrushConfig = {
    id: 'default',
    label: 'Standard Brush',
    category: 'pen',
    size: 5,
    opacity: 100,
    flow: 100,
    spacing: 1,
    hardness: 100,
    stabilization: 0,
    engine: 'vector',
    pressure: { size: true, opacity: false, flow: false },
    defaults: { size: 5, opacity: 100 }
};

// --- PRESETS ---

export const BRUSH_PRESETS: BrushConfig[] = [
    // A. PENCIL BRUSHES
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'real-pencil',
        label: 'Real Pencil',
        category: 'pencil',
        size: 4,
        opacity: 80,
        hardness: 60,
        spacing: 2,
        stabilization: 2,
        pressure: { size: true, opacity: true, flow: false },
        icon: '/assets/brushes/pencil-real.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'mechanical-pencil',
        label: 'Mechanical Pencil',
        category: 'pencil',
        size: 2,
        opacity: 90,
        hardness: 90,
        spacing: 1,
        stabilization: 5,
        pressure: { size: false, opacity: true, flow: false }, // Consistent line width
        icon: '/assets/brushes/pencil-mech.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'rough-pencil',
        label: 'Rough Pencil',
        category: 'pencil',
        size: 6,
        opacity: 70,
        hardness: 40,
        spacing: 4, // More gap for roughness
        stabilization: 1,
        pressure: { size: true, opacity: true, flow: true },
        icon: '/assets/brushes/pencil-rough.png'
    },

    // B. PEN / INKING BRUSHES
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'g-pen',
        label: 'G-Pen',
        category: 'pen',
        size: 5,
        opacity: 100,
        hardness: 100,
        stabilization: 10,
        pressure: { size: true, opacity: false, flow: false },
        icon: '/assets/brushes/pen-g.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'brush-pen',
        label: 'Brush Pen',
        category: 'pen',
        size: 15,
        opacity: 100,
        hardness: 80,
        stabilization: 15,
        pressure: { size: true, opacity: true, flow: false },
        icon: '/assets/brushes/pen-brush.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'felt-tip',
        label: 'Felt Tip Pen',
        category: 'pen',
        size: 8,
        opacity: 100,
        hardness: 100,
        stabilization: 5,
        pressure: { size: false, opacity: false, flow: false }, // Monoline
        icon: '/assets/brushes/pen-felt.png'
    },

    // C. PAINT BRUSHES
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'thick-paint',
        label: 'Thick Paint',
        category: 'paint',
        size: 20,
        opacity: 100,
        flow: 80,
        hardness: 90,
        spacing: 1,
        stabilization: 5,
        pressure: { size: true, opacity: false, flow: true },
        icon: '/assets/brushes/paint-thick.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'flat-brush',
        label: 'Flat Brush',
        category: 'paint',
        size: 30,
        opacity: 90,
        hardness: 100,
        baseShape: 'square',
        pressure: { size: true, opacity: true, flow: false },
        icon: '/assets/brushes/paint-flat.png'
    },

    // D. WATERCOLOR
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'watercolor-transparent',
        label: 'Transparent WC',
        category: 'watercolor',
        size: 30,
        opacity: 40,
        hardness: 20,
        spacing: 1,
        stabilization: 5,
        pressure: { size: true, opacity: true, flow: true },
        icon: '/assets/brushes/watercolor-trans.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'watercolor-bleed',
        label: 'Soft Bleed WC',
        category: 'watercolor',
        size: 40,
        opacity: 30,
        hardness: 0,
        stabilization: 3,
        pressure: { size: true, opacity: true, flow: true },
        icon: '/assets/brushes/watercolor-bleed.png'
    },

    // E. AIRBRUSH
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'soft-airbrush',
        label: 'Soft Airbrush',
        category: 'airbrush',
        size: 50,
        opacity: 50,
        hardness: 0,
        spacing: 1,
        stabilization: 0,
        pressure: { size: true, opacity: true, flow: true },
        icon: '/assets/brushes/airbrush-soft.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'dense-spray',
        label: 'Dense Spray',
        category: 'airbrush',
        size: 40,
        opacity: 80,
        hardness: 50,
        spacing: 1,
        stabilization: 0,
        engine: 'raster', // Implies spray brush
        pressure: { size: true, opacity: false, flow: true },
        icon: '/assets/brushes/airbrush-spray.png'
    },

    // F. DECORATION
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'clouds',
        label: 'Clouds',
        category: 'decoration',
        size: 100,
        opacity: 60,
        hardness: 0,
        engine: 'raster',
        baseShape: 'texture',
        pressure: { size: true, opacity: true, flow: false },
        icon: '/assets/brushes/deco-clouds.png'
    },
    {
        ...DEFAULT_BRUSH_CONFIG,
        id: 'sparkles',
        label: 'Sparkles',
        category: 'decoration',
        size: 50,
        opacity: 100,
        flow: 50,
        engine: 'raster',
        spacing: 20, // High spacing for scatter
        pressure: { size: true, opacity: false, flow: true },
        icon: '/assets/brushes/deco-sparkles.png'
    }
];

export const getBrushesByCategory = (category: BrushCategory) => {
    return BRUSH_PRESETS.filter(b => b.category === category);
};

export const getBrushById = (id: string) => {
    return BRUSH_PRESETS.find(b => b.id === id) || DEFAULT_BRUSH_CONFIG;
};

// CATEGORY CONFIG (For UI grouping)
export const BRUSH_CATEGORIES = [
    { id: 'pencil', label: 'Pencil', icon: Edit3 },
    { id: 'pen', label: 'Pen', icon: Pen },
    { id: 'paint', label: 'Paint', icon: Brush },
    { id: 'watercolor', label: 'Watercolor', icon: Brush }, // Reuse Brush icon or custom
    { id: 'airbrush', label: 'Airbrush', icon: SprayCan },
    { id: 'decoration', label: 'Decoration', icon: Sparkles },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
];
