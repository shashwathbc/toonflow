import React, { useEffect, useRef } from 'react';
import FabricCanvas from '@/components/editor/FabricCanvas';
import { useEditorStore } from '@/store/editorStore';
import { Canvas, FabricImage, PencilBrush } from 'fabric';

interface CanvasSegmentProps {
    pageId: number;
    width?: number;
    height?: number;
}

const CanvasSegment: React.FC<CanvasSegmentProps> = ({ pageId, width = 800, height = 1200 }) => {
    const { activePage, setActivePage, pageImages, setPageImage, activeTool, color, brushSize, isEditMode, undoTrigger, redoTrigger } = useEditorStore();
    const fabricRef = useRef<Canvas | null>(null);

    // History Stacks
    const history = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const isHistoryLocked = useRef(false); // prevent saving during undo/redo

    // Save History Snapshot
    const saveHistory = (canvas: Canvas) => {
        if (isHistoryLocked.current) return;

        // Push current state
        if (history.current.length > 20) history.current.shift(); // Limit stack
        history.current.push(JSON.stringify(canvas));
        redoStack.current = []; // Clear redo on new action
    };

    // Handle Undo/Redo Signals
    useEffect(() => {
        // Only undo on the currently focused page
        if (activePage !== pageId) return;

        const canvas = fabricRef.current;
        if (!canvas || history.current.length === 0) return;

        isHistoryLocked.current = true;

        // Pop current state first? No, we need to go back.
        // History structure: [State 0, State 1, State 2 (Recent)]

        const prevState = history.current.pop();
        if (prevState) {
            redoStack.current.push(JSON.stringify(canvas)); // Save current before undoing

            canvas.loadFromJSON(JSON.parse(prevState)).then(() => {
                canvas.renderAll();
                isHistoryLocked.current = false;
                // Sync thumbnail
                const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                setPageImage(pageId, dataUrl);
            });
        } else {
            isHistoryLocked.current = false;
        }

    }, [undoTrigger]);

    useEffect(() => {
        // Only redo on the currently focused page
        if (activePage !== pageId) return;

        const canvas = fabricRef.current;
        if (!canvas || redoStack.current.length === 0) return;

        isHistoryLocked.current = true;
        const nextState = redoStack.current.pop();

        if (nextState) {
            history.current.push(JSON.stringify(canvas)); // Save current before redoing
            canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
                canvas.renderAll();
                isHistoryLocked.current = false;
                // Sync thumbnail
                const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                setPageImage(pageId, dataUrl);
            });
        } else {
            isHistoryLocked.current = false;
        }
    }, [redoTrigger]);


    // Handle Canvas Ready
    const onCanvasReady = (canvas: Canvas) => {
        fabricRef.current = canvas;

        // Init History
        history.current.push(JSON.stringify(canvas));

        // Load existing image if any
        // DEBUG: Disabling image load to check if it obstructs drawing
        /*
        const existing = pageImages[pageId];
        if (existing) {
            try {
                FabricImage.fromURL(existing, { crossOrigin: 'anonymous' })
                    .then((img) => {
                        if (!canvas) return; // Cleanup check
                        canvas.clear();
                        canvas.add(img);
                        canvas.sendObjectToBack(img);
                        canvas.requestRenderAll();
                        // Save loaded state as base history too
                        history.current = [JSON.stringify(canvas)];
                    })
                    .catch(err => {
                        console.error("Failed to load page image:", err);
                    });
            } catch (e) {
                console.error("Error initiating image load:", e);
            }
        }
        */
        console.log("Canvas initialized (Fresh - Image Load Disabled)");

        // Set initial configuration
        updateInteraction(canvas);

        // Listen for path creation to persist changes
        // Using 'off' to prevent duplicates
        canvas.off('path:created');

        // Debounce timer ref
        let saveTimeout: NodeJS.Timeout;

        canvas.on('path:created', () => {
            console.log("Path created. Total Objects:", canvas.getObjects().length);

            // 1. Immediate Visual Update
            canvas.requestRenderAll();

            // 2. Save History (Undo/Redo)
            saveHistory(canvas);

            // 3. Debounce Heavy Persistence (Store/Thumbnail)
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (!canvas) return;
                try {
                    console.log("Auto-saving thumbnail...");
                    const dataUrl = canvas.toDataURL({
                        format: 'png',
                        multiplier: 1,
                        quality: 1
                    });
                    setPageImage(pageId, dataUrl);
                } catch (err) {
                    console.error("Save failed:", err);
                }
            }, 1000); // 1s debounce for safety
        });

        // Also listen for modifications (moves/resize) with same debounce
        canvas.on('object:modified', () => {
            saveHistory(canvas);
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                try {
                    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                    setPageImage(pageId, dataUrl);
                } catch (e) { }
            }, 1000);
        });
    };

    // Helper to update brush settings & interaction mode
    const updateInteraction = (canvas: Canvas) => {
        if (!canvas) return;

        // 1. Edit Mode Global Check
        if (!isEditMode) {
            canvas.isDrawingMode = false;
            canvas.selection = false;
            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'default';
            return;
        }

        // 2. Configure Drawing Tools
        const drawingTools = ['brush', 'pen', 'eraser'];
        const shouldDraw = drawingTools.includes(activeTool);

        if (shouldDraw) {
            canvas.selection = false; // Disable selection to allow drawing
            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.isDrawingMode = true;

            // Explicitly ensure a brush exists
            if (!canvas.freeDrawingBrush) {
                // Try/Catch in case PencilBrush import is weird
                try {
                    canvas.freeDrawingBrush = new PencilBrush(canvas);
                } catch (e) {
                    console.error("Failed to init brush:", e);
                }
            }

            if (canvas.freeDrawingBrush) {
                const brush = canvas.freeDrawingBrush;
                brush.width = brushSize || 5;
                brush.color = activeTool === 'eraser' ? 'white' : color;
                console.log(`[CanvasSegment] Brush Configured: Color=${brush.color}, Width=${brush.width}, Page=${pageId}`);
            }

        } else {
            // Select Mode
            canvas.isDrawingMode = false;
            canvas.selection = true;
            canvas.forEachObject(o => { o.selectable = true; o.evented = true; });
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        }
    };

    // React to tool changes or Edit Mode toggle
    useEffect(() => {
        if (fabricRef.current) {
            updateInteraction(fabricRef.current);
            fabricRef.current.requestRenderAll();
        }
    }, [activeTool, color, brushSize, isEditMode]);

    return (
        <div
            className={`relative transition-all duration-200 ${activePage === pageId ? 'z-10' : ''}`}
            style={{ width, height, marginBottom: '20px' }}
            onClick={() => setActivePage(pageId)}
        >
            {/* Page Number */}
            <div className={`absolute -left-10 top-0 text-xs font-bold px-2 py-1 rounded transition-colors ${activePage === pageId ? 'text-blue-400 bg-zinc-800' : 'text-zinc-600'}`}>
                {pageId}
            </div>

            <div className={`w-full h-full bg-white shadow-sm ${activePage === pageId && isEditMode ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-800' : ''}`} style={{ touchAction: 'none' }}>
                <FabricCanvas
                    onCanvasReady={onCanvasReady}
                    width={width}
                    height={height}
                    // className="bg-white" // REMOVED: Caused upper-canvas to be opaque white, hiding strokes
                    style={{ width: '100%', height: '100%', touchAction: 'none' }}
                />
            </div>
        </div>
    );
};

export default CanvasSegment;
