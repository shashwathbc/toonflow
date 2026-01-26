import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TOOL_CONFIG } from '../palettes/Tools/ToolPalette';
import CanvasSegment from './CanvasSegment';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';

interface DraggableSegmentProps {
    pageId: number;
}

const DraggableCanvasSegment: React.FC<DraggableSegmentProps> = ({ pageId }) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={pageId}
            className="relative group bg-white shadow-sm"
            dragListener={false}
            dragControls={controls}
        >
            {/* Drag Handle - Absolute positioned to the left */}
            <div
                className="absolute -left-10 top-4 cursor-grab active:cursor-grabbing p-2 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600 transition-colors z-50"
                onPointerDown={(e) => controls.start(e)}
            >
                <GripVertical size={20} />
            </div>

            <CanvasSegment
                pageId={pageId}
                width={700}
                height={1000}
            />
        </Reorder.Item>
    );
};

const WebtoonCanvas: React.FC = () => {
    const { pages, setPages, activeTool, scale, setScale } = useEditorStore();
    const containerRef = useRef<HTMLDivElement>(null);

    // Resolve Cursor from Config
    const currentToolConfig = TOOL_CONFIG.find(t => t.id === activeTool);
    let cursorStyle = currentToolConfig?.cursor || 'default';
    if (activeTool === 'pan') cursorStyle = 'grab';

    // Handle Zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY;
                const zoomStep = 0.1;
                const newScale = delta > 0 ? scale + zoomStep : scale - zoomStep;
                // Clamp scale between 0.1 and 5
                setScale(Math.min(Math.max(newScale, 0.1), 5));
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [scale, setScale]);

    // Handle Pan (Middle Click or Space+Drag logic could go here, but for now using Tool)
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'pan' || e.button === 1) { // Pan tool or Middle click
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning && containerRef.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            containerRef.current.scrollTop -= dy;
            containerRef.current.scrollLeft -= dx;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleUploadWebtoon = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) {
                // Handle file upload - you can implement the upload logic here
                console.log('Files to upload:', files);
                // TODO: Implement upload logic to add images as new pages
            }
        };
        input.click();
    };

    const handleDownloadPage = () => {
        // Download all pages as images
        const link = document.createElement('a');
        pages.forEach((pageId, index) => {
            // Get the canvas element for each page
            const canvasElement = document.querySelector(`canvas[data-page-id="${pageId}"]`) as HTMLCanvasElement;
            if (canvasElement) {
                setTimeout(() => {
                    link.href = canvasElement.toDataURL('image/png');
                    link.download = `page-${pageId}.png`;
                    link.click();
                }, index * 100); // Stagger downloads
            }
        });
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-auto bg-zinc-800/50 flex flex-col items-center py-10 canvas-scrollbar relative"
            style={{ cursor: isPanning ? 'grabbing' : cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.1s ease-out'
                }}
                className="flex flex-col items-center"
            >
                <Reorder.Group
                    axis="y"
                    values={pages}
                    onReorder={setPages}
                    className="flex flex-col shadow-2xl bg-white"
                >
                    {pages.map((pageId) => (
                        <DraggableCanvasSegment key={pageId} pageId={pageId} />
                    ))}


                    {/* Footer / Extend Button area */}
                    <div
                        className="w-full bg-zinc-100 p-4 flex justify-center border-t border-dashed border-zinc-300 text-zinc-500 text-sm hover:bg-zinc-200 cursor-pointer transition-colors"
                        onClick={() => {
                            const newPageId = Math.max(...pages, 0) + 1;
                            setPages([...pages, newPageId]);
                        }}
                    >
                        + Add Page / Extend Canvas
                    </div>
                </Reorder.Group>
            </div>
        </div>
    );
};

export default WebtoonCanvas;
