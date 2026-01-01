import React, { useEffect, useRef } from 'react';
import FabricCanvas from '@/components/editor/FabricCanvas';
import { useEditorStore } from '@/store/editorStore';
import { Canvas, FabricImage, PencilBrush, CircleBrush, SprayBrush, Group, Textbox, Line } from 'fabric';
import { createSmartBubble, BubbleType, autoFitText } from './utils/bubbleFactory';
import { CanvasBrushManager } from './utils/BrushManager';

interface CanvasSegmentProps {
    pageId: number;
    width?: number;
    height?: number;
}

const CanvasSegment: React.FC<CanvasSegmentProps> = ({ pageId, width = 800, height = 1200 }) => {
    const {
        activePage, setActivePage, pageImages, setPageImage,
        activeTool, activeCategory, activeBrushId, getStartBrushConfig,
        color, brushSize, opacity,
        isEditMode, undoTrigger, redoTrigger
    } = useEditorStore();

    const fabricRef = useRef<Canvas | null>(null);

    // Refs for Event Access
    const activeToolRef = useRef(activeTool);
    const activeCategoryRef = useRef(activeCategory);
    const colorRef = useRef(color);
    const brushSizeRef = useRef(brushSize);
    const opacityRef = useRef(opacity);

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
    useEffect(() => { opacityRef.current = opacity; }, [opacity]);

    // History Stacks
    const history = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const isHistoryLocked = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- 1. HISTORY & PERSISTENCE ---

    const saveHistory = (canvas: Canvas) => {
        if (isHistoryLocked.current) return;
        if (history.current.length > 20) history.current.shift();
        history.current.push(JSON.stringify(canvas));
        redoStack.current = [];
    };

    // Handle Undo
    useEffect(() => {
        if (activePage !== pageId) return;
        const canvas = fabricRef.current;
        if (!canvas || history.current.length === 0) return;

        isHistoryLocked.current = true;
        const prevState = history.current.pop();

        if (prevState) {
            redoStack.current.push(JSON.stringify(canvas));
            canvas.loadFromJSON(JSON.parse(prevState)).then(() => {
                canvas.requestRenderAll();
                isHistoryLocked.current = false;
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
            history.current.push(JSON.stringify(canvas));
            canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
                canvas.requestRenderAll();
                isHistoryLocked.current = false;
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

        // Logic to determine if we should be drawing
        // If activeTool is a utility (Select, Hand, etc), we are NOT drawing.
        // If activeTool is a Category ID (pen, pencil, etc) OR 'brush' legacy, we ARE drawing.
        const NON_DRAWING_TOOLS = ['select', 'pan', 'text', 'crop', 'fill', 'picker', 'shape-rect', 'shape-ellipse', 'line', 'panel-frame', 'wand'];
        const shouldDraw = !NON_DRAWING_TOOLS.includes(activeTool);

        if (shouldDraw) {
            canvas.selection = false;
            canvas.allowTouchScrolling = false; // Block scrolling while drawing

            // Force touch-action on DOM elements
            if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.touchAction = 'none';
            if (canvas.lowerCanvasEl) canvas.lowerCanvasEl.style.touchAction = 'none';

            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.isDrawingMode = true;

            // USE BRUSH MANAGER
            const config = getStartBrushConfig(activeBrushId);

            // Runtime config with global overrides
            const runtimeConfig = {
                ...config,
                color: activeTool === 'eraser' ? 'white' : color,
                size: brushSize,
                opacity: opacity
            };

            CanvasBrushManager.configureBrush(canvas, runtimeConfig as any);

            if (canvas.freeDrawingBrush) {
                // Double check color logic for eraser
                if (activeTool === 'eraser') {
                    canvas.freeDrawingBrush.color = 'white';
                }
                console.log(`[CanvasSegment] Brush Configured: ID=${activeBrushId}, Color=${canvas.freeDrawingBrush.color}`);
            }

        } else {
            // Select Mode
            canvas.isDrawingMode = false;
            canvas.selection = true;
            canvas.allowTouchScrolling = true; // Enable native scrolling behavior on touch

            // Force touch-action on DOM elements to allow panning
            if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.touchAction = 'pan-y';
            if (canvas.lowerCanvasEl) canvas.lowerCanvasEl.style.touchAction = 'pan-y';

            canvas.forEachObject(o => { o.selectable = true; o.evented = true; });
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        }
    };

    const onCanvasReady = (canvas: Canvas) => {
        fabricRef.current = canvas;

        // Init History
        history.current.push(JSON.stringify(canvas));
        console.log("Canvas initialized (Fresh - Image Load Disabled)");

        // Initial Config
        updateInteraction(canvas);

        // Listeners
        canvas.off('path:created');
        canvas.on('path:created', (e: any) => {
            console.log("Path created. Total Objects:", canvas.getObjects().length);

            // G-PEN STRAIGHT LINE LOGIC
            // Check category instead of tool ID now
            if (activeCategoryRef.current === 'pen') {
                // We might want to restrict straight line logic only if a specific sub-option is on, 
                // but for now let's keep it for 'pen' category as per previous behavior
                const path = e.path;
                if (path && path.path && path.path.length > 1) {
                    const cmds = path.path;
                    const startX = cmds[0][1];
                    const startY = cmds[0][2];
                    const lastCmd = cmds[cmds.length - 1];
                    const endX = lastCmd[lastCmd.length - 2];
                    const endY = lastCmd[lastCmd.length - 1];

                    if (typeof startX === 'number' && typeof endX === 'number') {
                        // Only convert if it looks like a straight line attempt? 
                        // For now keeping simple: always convert for 'pen' category if that was the rule.
                        // Actually, G-Pen usually isn't straight line only. 
                        // The user asked for "G-Pen Straight Line Correction" specifically in previous task.
                        // Maybe we should check if activeBrushId is 'g-pen'?
                        // For now, retaining 'pen' category check to match previous 'activeTool === pen' logic.

                        const line = new Line([startX, startY, endX, endY], {
                            stroke: colorRef.current,
                            strokeWidth: brushSizeRef.current,
                            strokeLineCap: 'round',
                            strokeLineJoin: 'round',
                            selectable: false,
                            evented: false,
                        });
                        canvas.remove(path);
                        canvas.add(line);
                    }
                }
            }

            canvas.requestRenderAll();
            saveHistory(canvas);

            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                if (!canvas) return;
                try {
                    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                    setPageImage(pageId, dataUrl);
                } catch (err) {
                    console.error("Save failed:", err);
                }
            }, 1000);
        });

        // Other listeners
        canvas.on('object:scaling', (e) => {
            const obj = e.target;
            if (obj && obj.type === 'group') {
                // @ts-ignore
                if (obj.data?.type === 'smartBubble') autoFitText(obj as Group);
            }
        });

        canvas.on('object:modified', (e) => {
            const obj = e.target;
            if (obj && obj.type === 'group') {
                // @ts-ignore
                if (obj.data?.type === 'smartBubble') autoFitText(obj as Group);
            }
            saveHistory(canvas);

            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                try {
                    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1, quality: 1 });
                    setPageImage(pageId, dataUrl);
                } catch (e) { }
            }, 1000);
        });

        canvas.on('text:changed', (e) => {
            const obj = e.target as Textbox;
            if (obj && obj.type === 'textbox' && obj.group) {
                const group = obj.group;
                // @ts-ignore
                if (group.data?.type === 'smartBubble') autoFitText(group);
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
    }, [activeTool, activeCategory, activeBrushId, color, brushSize, opacity, isEditMode]);

    // Determine if we should block touch scrolling (only in drawing mode)
    const isDrawingModeActive = isEditMode && ['pencil', 'pen', 'paint', 'watercolor', 'airbrush', 'eraser', 'decoration', 'brush'].includes(activeCategory || activeTool);

    return (
        <div
            className={`relative transition-all duration-200 ${activePage === pageId ? 'z-10' : ''}`}
            style={{ width, height, marginBottom: '20px' }}
            onClick={() => setActivePage(pageId)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div className={`absolute -left-10 top-0 text-xs font-bold px-2 py-1 rounded transition-colors ${activePage === pageId ? 'text-blue-400 bg-zinc-800' : 'text-zinc-600'}`}>
                {pageId}
            </div>

            <div
                className={`w-full h-full bg-white shadow-sm ${activePage === pageId && isEditMode ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-800' : ''}`}
                style={{
                    touchAction: isDrawingModeActive ? 'none' : 'pan-y' // Allow vertical scroll unless drawing
                }}
            >
                <FabricCanvas
                    onCanvasReady={onCanvasReady}
                    width={width}
                    height={height}
                    style={{
                        width: '100%',
                        height: '100%',
                        touchAction: isDrawingModeActive ? 'none' : 'pan-y'
                    }}
                />
            </div>
        </div>
    );
};

export default CanvasSegment;
