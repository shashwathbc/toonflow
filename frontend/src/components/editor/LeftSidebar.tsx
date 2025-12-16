import React from 'react';
import { Button } from "@/components/ui/button";
import { HexAlphaColorPicker } from "react-colorful";

interface LeftSidebarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  hardness: number;
  setHardness: (hardness: number) => void;
  stabilize: boolean;
  setStabilize: (stabilize: boolean) => void;
  color: string;
  setColor: (color: string) => void;
  recentColors: string[];
  chooseColor: (color: string) => void;
}

type Tool =
  | "pan"
  | "select"
  | "brush"
  | "pen" // Added
  | "eraser"
  | "fill"
  | "picker" // Added
  | "crop" // Added
  | "shape-rect"
  | "shape-ellipse"
  | "line"
  | "text"
  | "panel-frame"
  | "wand"
  | "line-width"
  | "smooth";

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTool,
  setActiveTool,
  brushSize,
  setBrushSize,
  opacity,
  setOpacity,
  hardness,
  setHardness,
  stabilize,
  setStabilize,
  color,
  recentColors,
  chooseColor
}) => {
  return (
    <div className="w-full bg-card p-3 flex flex-col overflow-y-auto">
      <h3 className="font-semibold mb-3">Tools</h3>

      {/* Icon toolbar */}
      <div className="grid grid-cols-4 gap-2">
        {/* Tool buttons */}
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "pan" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("pan")}
          title="Hand / Pan"
        >
          <span className="text-base">✋</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "select" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("select")}
          title="Select / Transform"
        >
          <span className="text-base">↗️</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "brush" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("brush")}
          title="Brush"
        >
          <span className="text-base">🖌️</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "pen" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("pen")}
          title="Pen"
        >
          <span className="text-base">✒️</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "eraser" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("eraser")}
          title="Eraser"
        >
          <span className="text-base">🧼</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "picker" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("picker")}
          title="Color Picker"
        >
          <span className="text-base">🧴</span>
        </button>
        <button
          className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeTool === "crop" ? "bg-muted ring-2 ring-primary" : "bg-background hover:bg-muted"}`}
          onClick={() => setActiveTool("crop")}
          title="Crop"
        >
          <span className="text-base">✂️</span>
        </button>
      </div>

      <div className="my-3 h-px bg-border" />

      {/* Tool Properties */}
      <div className="space-y-3">
        {["brush", "eraser", "line"].includes(activeTool) && (
          <>
            <div>
              <label htmlFor="brushSizeRange" className="text-sm">Brush Size: {brushSize}px</label>
              <input
                id="brushSizeRange"
                type="range"
                min={1}
                max={64}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {activeTool !== "eraser" && (
              <div>
                <label htmlFor="opacityRange" className="text-sm">Opacity: {opacity}%</label>
                <input
                  id="opacityRange"
                  type="range"
                  min={1}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {activeTool === "brush" && (
              <>
                <div>
                  <label htmlFor="hardnessRange" className="text-sm">Hardness: {hardness}%</label>
                  <input
                    id="hardnessRange"
                    type="range"
                    min={0}
                    max={100}
                    value={hardness}
                    onChange={(e) => setHardness(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stabilize}
                    onChange={(e) => setStabilize(e.target.checked)}
                  />
                  Stabilize lines
                </label>
              </>
            )}
          </>
        )}

        {/* Other tool-specific properties */}
      </div>

      <div className="my-3 h-px bg-border" />

      {/* Color & Swatches */}

      <div className="space-y-4">
        <div className="text-xs text-muted-foreground font-medium">Color</div>
        <div className="flex flex-col gap-3">
          <div className="custom-color-picker">
            <HexAlphaColorPicker color={color} onChange={chooseColor} style={{ width: '100%' }} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8">Hex</span>
            <input
              type="text"
              value={color}
              onChange={(e) => chooseColor(e.target.value)}
              className="flex-1 h-8 rounded border px-2 text-xs uppercase"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            {recentColors.map((c) => (
              <button
                key={c}
                className="h-8 w-8 rounded-md border shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                onClick={() => chooseColor(c)}
                title={c}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;