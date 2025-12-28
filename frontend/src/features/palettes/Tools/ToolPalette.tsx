import React from "react";
import {
    Hand,
    MousePointer2,
    Brush,
    Pen,
    Eraser,
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

// Tool Configuration Mapping
export const TOOL_CONFIG = [
    { id: "pan", icon: Hand, label: "Pan / Hand Tool", cursor: "grab" },
    { id: "select", icon: MousePointer2, label: "Select / Move", cursor: "default" },
    { id: "brush", icon: Brush, label: "Brush Tool", cursor: "crosshair" },
    { id: "pen", icon: Pen, label: "G-Pen Tool", cursor: "crosshair" },
    { id: "eraser", icon: Eraser, label: "Eraser", cursor: "crosshair" },
    { id: "fill", icon: Pipette, label: "Fill Bucket", cursor: "cell" },
    { id: "picker", icon: Pipette, label: "Color Picker", cursor: "crosshair" },
    { id: "crop", icon: Crop, label: "Crop Canvas", cursor: "crosshair" },
    { id: "shape-rect", icon: Square, label: "Rectangle Tool", cursor: "crosshair" },
    { id: "shape-ellipse", icon: Circle, label: "Ellipse Tool", cursor: "crosshair" },
    { id: "line", icon: Minus, label: "Line Tool", cursor: "crosshair" },
    { id: "text", icon: Type, label: "Text Tool", cursor: "text" },
    { id: "panel-frame", icon: LayoutTemplate, label: "Frame Tool", cursor: "crosshair" },
    { id: "wand", icon: Wand2, label: "Magic Wand", cursor: "crosshair" },
] as const;

export type ToolId = typeof TOOL_CONFIG[number]["id"];

const ToolPalette: React.FC = () => {
    const { activeTool, setActiveTool } = useEditorStore();

    return (
        <div className="flex flex-col gap-1 w-full h-full p-2 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
            <h3 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider px-1">Tools</h3>
            <div className="grid grid-cols-2 gap-1.5">
                {TOOL_CONFIG.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        title={tool.label}
                        className={`group relative flex items-center justify-center p-2 rounded-md transition-all
              ${activeTool === tool.id
                                ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                            }`}
                    >
                        <tool.icon size={18} strokeWidth={2} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ToolPalette;
