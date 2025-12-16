import React, { useRef, useEffect, useState } from 'react';
import { Canvas } from 'fabric';
import FabricCanvas from './FabricCanvas';
import CursorOverlay from './CursorOverlay';

interface CanvasAreaProps {
  template: string;
  setTemplate: (template: string) => void;
  totalPages: number;
  setTotalPages: (pages: number) => void;
  pages: number[];
  pageImages: Record<number, string>;
  editingPage: number | null;
  setEditingPage: (page: number | null) => void;
  onCanvasReady: (canvas: Canvas) => void;
  saveCanvasEdits: () => void;
  discardCanvasEdits: () => void;
  onDropOnPage: (pageNum: number, url: string) => void;
  onDropOnCanvas: (e: React.DragEvent<HTMLDivElement>) => void;
  // Cursor props
  isEditMode?: boolean;
  activeTool?: string;
  brushSize?: number;
  opacity?: number;
  color?: string;
}

const CanvasArea: React.FC<CanvasAreaProps> = ({
  template,
  setTemplate,
  totalPages,
  setTotalPages,
  pages,
  pageImages,
  editingPage,
  setEditingPage,
  onCanvasReady,
  saveCanvasEdits,
  discardCanvasEdits,
  onDropOnPage,
  onDropOnCanvas,
  isEditMode = false,
  activeTool = 'select',
  brushSize = 4,
  opacity = 100,
  color = '#000000'
}) => {
  // We need to measure the container size to pass to FabricCanvas
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Track hover for cursor
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [editingPage]);

  // Handle cursor visibility CSS
  const interactionStyle = isEditMode && isHovered && ['brush', 'pen', 'eraser', 'picker', 'crop'].includes(activeTool)
    ? { cursor: 'none' }
    : {};

  return (
    <div className="w-full flex flex-col h-full bg-muted/20">

      {/* Custom Cursor Overlay */}
      <CursorOverlay
        activeTool={activeTool}
        brushSize={brushSize}
        opacity={opacity}
        color={color}
        isEditMode={isEditMode}
        isActive={isHovered}
      />

      <div className="border-b bg-card/50 p-4 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label htmlFor="template" className="text-sm font-medium">
            Template:
          </label>
          <select
            id="template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent"
          >
            <option value="Blank">Blank</option>
            <option value="Portfolio">Portfolio</option>
            <option value="Business Report">Business Report</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="pageCount" className="text-sm font-medium">
            Number of Pages:
          </label>
          <select
            id="pageCount"
            value={totalPages}
            onChange={(e) => setTotalPages(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent"
          >
            {Array.from({ length: 30 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative">
        <div
          className="absolute inset-0 overflow-y-auto scrollbar-thin"
        >
          <div className="w-full max-w-4xl mx-auto p-8 space-y-8">
            {pages.map((pageNum) => (
              <div
                key={pageNum}
                className="relative bg-white aspect-[2/3] shadow-2xl rounded-lg border-2 border-border hover:border-primary transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
                onClick={() => setEditingPage(pageNum)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (editingPage !== pageNum) {
                    const url = e.dataTransfer.getData("text/plain");
                    if (url) onDropOnPage(pageNum, url);
                  }
                }}
              >
                {/* Only show static image if NOT editing this page (prevents duplicate layers) */}
                {editingPage !== pageNum && pageImages[pageNum] ? (
                  <img
                    src={pageImages[pageNum]}
                    alt={`Page ${pageNum}`}
                    className="w-full h-full object-cover"
                  />
                ) : editingPage !== pageNum ? (
                  <div className="text-center text-muted-foreground">
                    <div className="text-6xl font-bold mb-2">{pageNum}</div>
                    <div className="text-sm">Page {pageNum}</div>
                    <div className="text-xs mt-2">Click to start drawing</div>
                  </div>
                ) : null}

                {editingPage === pageNum && (
                  <div
                    className="absolute inset-0 z-50 flex flex-col pointer-events-none justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top bar with buttons */}
                    <div className="p-4 flex gap-3 justify-end pointer-events-auto">
                      <button
                        className="px-4 py-2 rounded-full bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 shadow-lg transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          discardCanvasEdits();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 shadow-[0_0_20px_rgba(var(--primary),0.6)] animate-pulse hover:animate-none transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveCanvasEdits();
                        }}
                      >
                        Save Changes
                      </button>
                    </div>

                    <div
                      ref={containerRef}
                      className="flex-1 overflow-hidden flex items-center justify-center pointer-events-auto"
                      style={interactionStyle}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDropOnCanvas}
                    >
                      <FabricCanvas
                        onCanvasReady={onCanvasReady}
                        width={dimensions.width}
                        height={dimensions.height}
                        style={{ backgroundColor: 'transparent' }} // Ensure canvas itself doesn't force a cursor if not needed
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasArea;