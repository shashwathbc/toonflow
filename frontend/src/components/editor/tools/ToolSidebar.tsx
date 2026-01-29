
import React from 'react';
import { PenTool, Paintbrush, Eraser, Move, MousePointer2, Image as ImageIcon, Type, Square, MessageCircle, Wand2, Minus, ScanLine, Lasso } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';

const TOOLS = [
    { id: 'select', icon: MousePointer2, label: 'Move / Edit' },
    { id: 'selection-rect', icon: ScanLine, label: 'Rect Select' },
    { id: 'selection-lasso', icon: Lasso, label: 'Lasso Select' },
    { id: 'pan', icon: Move, label: 'Pan' },
    { id: 'pen', icon: PenTool, label: 'Pen' },
    { id: 'paint', icon: Paintbrush, label: 'Paint' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'wand', icon: Wand2, label: 'Magic Wand' },
    { id: 'shape', icon: Square, label: 'Shapes' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'bubbles', icon: MessageCircle, label: 'Bubbles' },
    { id: 'image', icon: ImageIcon, label: 'Import' },
];


const ToolSidebar = () => {
    const { activeTool, setActiveTool, activeCategory } = useEditorStore();

    return (
        <div className="flex flex-col items-center py-4 gap-2 w-full">
            {TOOLS.map((tool) => {
                const isActive = activeTool === tool.id || (activeCategory === tool.id); // Loose check for simplified UI
                return (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className={cn(
                            "p-3 rounded-xl transition-all duration-200 group relative",
                            isActive
                                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        )}
                        title={tool.label}
                    >
                        <tool.icon size={20} strokeWidth={isActive ? 2.5 : 2} />

                        {/* Tooltip on Hover */}
                        <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-zinc-800">
                            {tool.label}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default ToolSidebar;
