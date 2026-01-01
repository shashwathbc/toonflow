import React from "react";
import {
    Hand,
    MousePointer2,
    Pipette,
    Crop,
    Square,
    Circle,
    Minus,
    Type,
    LayoutTemplate,
    Wand2
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { BRUSH_CATEGORIES } from "@/config/brushRegistry";

// Non-Brush Tools
export const UTILITY_TOOLS = [
    { id: "pan", icon: Hand, label: "Pan / Hand Tool", cursor: "grab" },
    { id: "select", icon: MousePointer2, label: "Select / Move", cursor: "default" },
    { id: "fill", icon: Pipette, label: "Fill Bucket", cursor: "cell" },
    { id: "picker", icon: Pipette, label: "Color Picker", cursor: "crosshair" },
    { id: "text", icon: Type, label: "Text Tool", cursor: "text" },
    { id: "line", icon: Minus, label: "Line Tool", cursor: "crosshair" },
    { id: "shape-rect", icon: Square, label: "Rectangle Tool", cursor: "crosshair" },
    { id: "shape-ellipse", icon: Circle, label: "Ellipse Tool", cursor: "crosshair" },
    { id: "crop", icon: Crop, label: "Crop Canvas", cursor: "crosshair" },
    { id: "panel-frame", icon: LayoutTemplate, label: "Frame Tool", cursor: "crosshair" },
    { id: "wand", icon: Wand2, label: "Magic Wand", cursor: "crosshair" },
] as const;

// Combined Config for Consumers (WebtoonCanvas etc.)
export const TOOL_CONFIG = [
    ...BRUSH_CATEGORIES.map(cat => ({
        id: cat.id,
        icon: cat.icon,
        label: cat.label,
        cursor: "crosshair" as const
    })),
    ...UTILITY_TOOLS
];

const ToolPalette: React.FC = () => {
    const { activeTool, activeCategory, setActiveTool } = useEditorStore();

    return (
        <div className="flex flex-col gap-1 w-full h-full p-2 bg-[#1e1e1e] border-r border-zinc-800 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {/* BRUSH TOOLS SECTION */}
            <div className="mb-2">
                <h3 className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider px-2">Brushes</h3>
                <div className="flex flex-col gap-1 w-full px-1">
                    {BRUSH_CATEGORIES.map((cat) => {
                        // Check if this category is currently active (via activeCategory state)
                        // If activeTool is a utility tool, brushes shouldn't look active.
                        const isUtility = UTILITY_TOOLS.some(u => u.id === activeTool);
                        const isActive = !isUtility && activeCategory === cat.id;

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTool(cat.id)} // Store handles mapping 'pencil' -> category 'pencil'
                                className={`group relative flex items-center w-full px-3 py-2 rounded-md transition-all gap-3
                                ${isActive
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                        : "bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                    }`}
                                title={cat.label}
                            >
                                <cat.icon size={18} strokeWidth={2} className="flex-shrink-0" />
                                <span className="text-sm font-medium truncate">{cat.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* SEPARATOR */}
            <div className="my-1 border-t border-zinc-800 mx-2" />

            {/* UTILITY TOOLS SECTION */}
            <div className="mt-2">
                <h3 className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider px-2">Tools</h3>
                <div className="flex flex-col gap-1 w-full px-1">
                    {UTILITY_TOOLS.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`group relative flex items-center w-full px-3 py-2 rounded-md transition-all gap-3
                            ${activeTool === tool.id
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                    : "bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                }`}
                            title={tool.label}
                        >
                            <tool.icon size={18} strokeWidth={2} className="flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{tool.label}</span>
                            {activeTool === tool.id && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ToolPalette;
