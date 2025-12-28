import React, { useEffect, useRef } from 'react';
import FabricCanvas from '@/components/editor/FabricCanvas';
import { useEditorStore } from '@/store/editorStore';
import { Canvas, FabricImage, PencilBrush, Group, Textbox } from 'fabric';
import { createSmartBubble, BubbleType } from './utils/bubbleFactory';

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

    // Save timeout ref for debouncing
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    // --- 1. HISTORY & PERSISTENCE ---

    const saveHistory = (canvas: Canvas) => {
        if (isHistoryLocked.current) return;

        // Push current state
        if (history.current.length > 20) history.current.shift(); // Limit stack
        history.current.push(JSON.stringify(canvas));
        redoStack.current = []; // Clear redo on new action
    };

    // Handle Undo
    useEffect(() => {
        if (activePage !== pageId) return;
        const canvas = fabricRef.current;
        if (!canvas || history.current.length === 0) return;

        isHistoryLocked.current = true;
        const prevState = history.current.pop();

        if (prevState) {
            redoStack.current.push(JSON.stringify(canvas)); // Save current before undoing
            canvas.loadFromJSON(JSON.parse(prevState)).then(() => {
                canvas.requestRenderAll();
                isHistoryLocked.current = false;
                // Sync thumbnail
                const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                setPageImage(pageId, dataUrl);
            });
        } else {
            isHistoryLocked.current = false;
        }
    }, [undoTrigger]);

    // Handle Redo
    useEffect(() => {
        if (activePage !== pageId) return;
        const canvas = fabricRef.current;
        if (!canvas || redoStack.current.length === 0) return;

        isHistoryLocked.current = true;
        const nextState = redoStack.current.pop();

        if (nextState) {
            history.current.push(JSON.stringify(canvas)); // Save current before redoing
            canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
                canvas.requestRenderAll();
                isHistoryLocked.current = false;
                // Sync thumbnail
                const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                setPageImage(pageId, dataUrl);
            });
        } else {
            isHistoryLocked.current = false;
        }
    }, [redoTrigger]);


    // --- 2. DRAG & DROP HANDLERS ---





    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const canvas = fabricRef.current;
        if (!canvas || !isEditMode) return;

        const assetType = e.dataTransfer.getData('assetType');
        const bubbleType = e.dataTransfer.getData('bubbleType');

        if (assetType === 'bubble' && bubbleType) {
            const pointer = canvas.getScenePoint(e.nativeEvent);
            const bubbleGroup = createSmartBubble(canvas, bubbleType as BubbleType, pointer.x, pointer.y);
            canvas.add(bubbleGroup);
            canvas.setActiveObject(bubbleGroup);
            saveHistory(canvas);
            canvas.requestRenderAll();
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };


    // --- 3. CANVAS INITIALIZATION & INTERACTION ---

    const updateInteraction = (canvas: Canvas) => {
        if (!canvas) return;

        // Edit Mode Global Check
        if (!isEditMode) {
            canvas.isDrawingMode = false;
            canvas.selection = false;
            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'default';
            return;
        }

        // Configure Drawing Tools
        const drawingTools = ['brush', 'pen', 'eraser'];
        const shouldDraw = drawingTools.includes(activeTool);

        if (shouldDraw) {
            canvas.selection = false;
            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.isDrawingMode = true;

            if (!canvas.freeDrawingBrush) {
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

    const onCanvasReady = (canvas: Canvas) => {
        fabricRef.current = canvas;

        // Init History
        history.current.push(JSON.stringify(canvas));

        // Image Load (Disabled for now as per debug status)
        console.log("Canvas initialized (Fresh - Image Load Disabled)");

        // Initial Config
        updateInteraction(canvas);

        // Listeners
        canvas.off('path:created');
        canvas.on('path:created', () => {
            console.log("Path created. Total Objects:", canvas.getObjects().length);
            canvas.requestRenderAll();
            saveHistory(canvas);

            // Debounce Thumbnail Save
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                if (!canvas) return;
                try {
                    console.log("Auto-saving thumbnail...");
                    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                    setPageImage(pageId, dataUrl);
                } catch (err) {
                    console.error("Save failed:", err);
                }
            }, 1000);
        });

        canvas.on('object:modified', () => {
            saveHistory(canvas);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                try {
                    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                    setPageImage(pageId, dataUrl);
                } catch (e) { }
            }, 1000);
        });

        // Auto-Fit Text Listener
        canvas.on('text:changed', (e) => {
            const obj = e.target as Textbox;
            // Check if it's our bubble text (we marked it with bg: 'bubbleText' or via group data)
            if (obj && obj.type === 'textbox' && obj.group) {
                const group = obj.group;
                // @ts-ignore
                if (group.data?.type === 'smartBubble') {
                    // Simple Auto-Fit: Reduce font size if height exceeds limit
                    // Ideally we check bounding box relative to shape
                    const maxHeight = group.height * 0.8;
                    if (obj.height > maxHeight && obj.fontSize > 10) {
                        obj.set('fontSize', obj.fontSize - 1);
                    }
                }
            }
            saveHistory(canvas);
        });
    };

    // React to tool changes
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
            onDrop={handleDrop}
            onDragOver={handleDragOver}
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
                    // className="bg-white" // Removed for visibility fix
                    style={{ width: '100%', height: '100%', touchAction: 'none' }}
                />
            </div>
        </div>
    );
};

export default CanvasSegment;
