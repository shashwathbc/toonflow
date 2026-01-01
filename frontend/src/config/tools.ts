import { Pen, Brush, Eraser, Square, Type, Search } from 'lucide-react';

export type ToolPropertyType = 'slider' | 'number' | 'boolean' | 'color';

export interface ToolPropertyConfig {
    id: string;
    label: string;
    type: ToolPropertyType;
    min?: number;
    max?: number;
    step?: number;
    default: any;
}

export interface SubToolConfig {
    id: string;
    label: string;
    icon?: any; // Lucide icon or string
    properties: ToolPropertyConfig[];
}

export interface MainToolConfig {
    id: string;
    label: string;
    subTools: SubToolConfig[];
}

export const TOOLS_REGISTRY: Record<string, MainToolConfig> = {
    pen: {
        id: 'pen',
        label: 'Pen',
        subTools: [
            {
                id: 'g-pen',
                label: 'G-Pen',
                properties: [
                    { id: 'size', label: 'Brush Size', type: 'slider', min: 1, max: 100, default: 5 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 100 },
                    { id: 'antiAlias', label: 'Anti-aliasing', type: 'boolean', default: true },
                ]
            },
            {
                id: 'real-pencil',
                label: 'Real Pencil',
                properties: [
                    { id: 'size', label: 'Brush Size', type: 'slider', min: 1, max: 50, default: 3 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 80 },
                    { id: 'stabilization', label: 'Stabilization', type: 'slider', min: 0, max: 10, default: 2 },
                ]
            },
            {
                id: 'marker',
                label: 'Marker',
                properties: [
                    { id: 'size', label: 'Brush Size', type: 'slider', min: 1, max: 200, default: 20 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 50 },
                ]
            }
        ]
    },
    brush: {
        id: 'brush',
        label: 'Brush',
        subTools: [
            {
                id: 'ink-brush',
                label: 'Ink Brush',
                icon: '/assets/brushes/ink-brush.png',
                properties: [
                    { id: 'size', label: 'Size', type: 'slider', min: 1, max: 100, default: 8 },
                    { id: 'opacity', label: 'Density', type: 'slider', min: 0, max: 100, default: 100 },
                    { id: 'stabilization', label: 'Stabilization', type: 'slider', min: 0, max: 20, default: 5 },
                ]
            },
            {
                id: 'watercolor',
                label: 'Watercolor',
                icon: '/assets/brushes/watercolor.png',
                properties: [
                    { id: 'size', label: 'Brush Size', type: 'slider', min: 5, max: 150, default: 30 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 60 },
                    { id: 'blend', label: 'Color Blending', type: 'slider', min: 0, max: 100, default: 50 },
                ]
            },
            {
                id: 'gouache',
                label: 'Gouache',
                icon: '/assets/brushes/gouache.png',
                properties: [
                    { id: 'size', label: 'Size', type: 'slider', min: 1, max: 100, default: 15 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 90 },
                    { id: 'impasto', label: 'Thickness', type: 'slider', min: 0, max: 100, default: 20 },
                ]
            },
            {
                id: 'airbrush',
                label: 'Airbrush',
                icon: '/assets/brushes/airbrush.png',
                properties: [
                    { id: 'size', label: 'Size', type: 'slider', min: 1, max: 300, default: 50 },
                    { id: 'opacity', label: 'Density', type: 'slider', min: 0, max: 100, default: 30 },
                ]
            }
        ]
    },
    eraser: {
        id: 'eraser',
        label: 'Eraser',
        subTools: [
            {
                id: 'hard-eraser',
                label: 'Hard Eraser',
                properties: [
                    { id: 'size', label: 'Size', type: 'slider', min: 1, max: 200, default: 20 },
                ]
            },
            {
                id: 'soft-eraser',
                label: 'Soft Eraser',
                properties: [
                    { id: 'size', label: 'Size', type: 'slider', min: 1, max: 200, default: 40 },
                    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, default: 50 },
                ]
            }
        ]
    },
    // Default fallback for tools without subtools (like Hand/App tools)
    default: {
        id: 'default',
        label: 'Tool Properties',
        subTools: []
    }
};
