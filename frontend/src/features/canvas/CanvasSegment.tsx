import React, { useEffect, useRef } from 'react';
import FabricCanvas from '@/components/editor/FabricCanvas';
import { useEditorStore } from '@/store/editorStore';
import { Canvas, FabricImage, PencilBrush, CircleBrush, SprayBrush, Group, Textbox, Line, Rect, Ellipse } from 'fabric';
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
        isEditMode, undoTrigger, redoTrigger,
        // Layer System
        layers, activeLayerId
    } = useEditorStore();

    const fabricRef = useRef<Canvas | null>(null);
    const loadedImageRef = useRef<string | null>(null); // Track which image URL is loaded

    // Refs for Event Access
    const activeToolRef = useRef(activeTool);
    const activeCategoryRef = useRef(activeCategory);
    const colorRef = useRef(color);
    const brushSizeRef = useRef(brushSize);
    const opacityRef = useRef(opacity);
    // Layer Refs
    const activeLayerIdRef = useRef(activeLayerId);
    const layersRef = useRef(layers);

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
    useEffect(() => { opacityRef.current = opacity; }, [opacity]);
    useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
    useEffect(() => { layersRef.current = layers; }, [layers]);

    // --- LOAD AI GENERATED IMAGE INTO CANVAS ---
    useEffect(() => {
        const imageUrl = pageImages[pageId];
        const canvas = fabricRef.current;

        // Only load if we have a new image that hasn't been loaded yet
        if (!canvas || !imageUrl || imageUrl === loadedImageRef.current) return;

        console.log(`[CanvasSegment] Loading AI image for page ${pageId}`);

        // Load the image using Fabric
        FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
            .then((img) => {
                if (!img || !fabricRef.current) return;

                // Scale image to fit canvas while maintaining aspect ratio
                const canvasWidth = fabricRef.current.width || width;
                const canvasHeight = fabricRef.current.height || height;

                const scaleX = canvasWidth / (img.width || 1);
                const scaleY = canvasHeight / (img.height || 1);
                const scale = Math.min(scaleX, scaleY);

                // Assign to 'Layer 0' or specific Image Layer if exists, else generic
                // For now, let's look for a layer of type 'image'
                const imageLayer = layersRef.current.find(l => l.type === 'image') || layersRef.current[0];
                const targetLayerId = imageLayer ? imageLayer.id : 'default';

                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    left: (canvasWidth - (img.width || 0) * scale) / 2,
                    top: (canvasHeight - (img.height || 0) * scale) / 2,
                    selectable: true,
                    evented: true,
                    // @ts-ignore
                    data: { ...img.data, layerId: targetLayerId }
                });

                // Add to canvas
                fabricRef.current.add(img);
                fabricRef.current.sendObjectToBack(img);
                fabricRef.current.requestRenderAll();

                // Save to history
                saveHistory(fabricRef.current);
                loadedImageRef.current = imageUrl;

                console.log(`[CanvasSegment] AI image loaded successfully for page ${pageId}`);
            })
            .catch((err) => {
                console.error('[CanvasSegment] Failed to load AI image:', err);
            });
    }, [pageImages[pageId], pageId, layers]); // Added layers dep just in case, though usually stable enough

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
        if (!canvas || history.current.length == 0) return;

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
        e.stopPropagation();

        const canvas = fabricRef.current;
        if (!canvas || !isEditMode) return;

        // Prevent multiple drops if event fires rapidly (though unlikely with stopPropagation)
        if ((canvas as any).isProcessingDrop) return;
        (canvas as any).isProcessingDrop = true;

        try {
            let assetType = e.dataTransfer.getData('assetType');
            let bubbleType = e.dataTransfer.getData('bubbleType');

            // Fallback: Try parsing JSON if direct keys failed
            if (!assetType) {
                try {
                    const jsonStr = e.dataTransfer.getData('application/json');
                    if (jsonStr) {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.type === 'bubble') {
                            assetType = 'bubble';
                            bubbleType = parsed.bubbleType;
                        }
                    }
                } catch (err) { /* ignore */ }
            }

            const charData = e.dataTransfer.getData('application/toonary-character');
            const draggedUrl = e.dataTransfer.getData('text/plain');

            const pointer = canvas.getScenePoint(e.nativeEvent);

            // 1. SMART BUBBLES
            if (assetType === 'bubble' && bubbleType) {
                const bubbleGroup = createSmartBubble(canvas, bubbleType as BubbleType, pointer.x, pointer.y);
                // @ts-ignore
                bubbleGroup.set('data', { ...bubbleGroup.data, layerId: activeLayerIdRef.current });
                canvas.add(bubbleGroup);
                canvas.setActiveObject(bubbleGroup);
                saveHistory(canvas);
                canvas.requestRenderAll();
                return;
            }

            // 2. CHARACTER / IMAGE ASSETS
            let imageUrlToLoad = '';

            // Strict Priority: Custom Image -> Character -> Default URL
            if (assetType === 'image') {
                imageUrlToLoad = e.dataTransfer.getData('imageUrl');
            } else if (charData) {
                try {
                    const char = JSON.parse(charData);
                    imageUrlToLoad = char.imageUrl;
                } catch (err) { }
            } else if (draggedUrl && (draggedUrl.startsWith('http') || draggedUrl.startsWith('data:'))) {
                // Check if it's not a JSON string (sometimes text/plain contains JSON reference)
                if (!draggedUrl.trim().startsWith('{')) {
                    imageUrlToLoad = draggedUrl;
                }
            }

            if (imageUrlToLoad) {
                // Check if this image was JUST added (naive debounce)
                // @ts-ignore
                if (canvas.lastDroppedUrl === imageUrlToLoad && (Date.now() - (canvas.lastDroppedTime || 0) < 500)) {
                    console.log("Duplicate drop prevented");
                    return;
                }

                // @ts-ignore
                canvas.lastDroppedUrl = imageUrlToLoad;
                // @ts-ignore
                canvas.lastDroppedTime = Date.now();

                const img = await FabricImage.fromURL(imageUrlToLoad, { crossOrigin: 'anonymous' });
                if (!img || !canvas) return;

                // Scale down if huge
                if (img.width && img.width > 500) {
                    img.scaleToWidth(400);
                }

                img.set({
                    left: pointer.x - (img.getScaledWidth() / 2),
                    top: pointer.y - (img.getScaledHeight() / 2),
                    // @ts-ignore
                    data: { layerId: activeLayerIdRef.current }
                });

                canvas.add(img);
                canvas.setActiveObject(img);
                saveHistory(canvas);
                canvas.requestRenderAll();
            }
        } finally {
            (canvas as any).isProcessingDrop = false;
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    // --- 3. CANVAS INITIALIZATION & INTERACTION ---

    const updateInteraction = (canvas: Canvas) => {
        if (!canvas) return;

        // Current Layer State
        const currentLayers = layersRef.current;
        const currentActiveLayerId = activeLayerIdRef.current;
        const layerMap = new Map(currentLayers.map(l => [l.id, l]));
        const activeLayer = layerMap.get(currentActiveLayerId);

        // Edit Mode Global Check
        if (!isEditMode) {
            canvas.isDrawingMode = false;
            canvas.selection = false;
            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'default';
            return;
        }

        // --- LAYER VISIBILITY & LOCKING LOGIC ---
        canvas.forEachObject(obj => {
            // @ts-ignore
            const objLayerId = obj.data?.layerId;
            const layer = layerMap.get(objLayerId);

            if (layer) {
                obj.visible = layer.visible;
                const isLayerEditable = !layer.locked && (layer.id === currentActiveLayerId) && layer.visible;
                obj.selectable = isLayerEditable;
                obj.evented = isLayerEditable;
            } else {
                obj.selectable = false;
                obj.evented = false;
            }
        });

        // DRAWING LOGIC
        const NON_DRAWING_TOOLS = ['select', 'pan', 'text', 'crop', 'fill', 'picker', 'shape-rect', 'shape-ellipse', 'line', 'panel-frame', 'wand'];
        const shouldDraw = !NON_DRAWING_TOOLS.includes(activeTool);

        // Only allow drawing if active layer is VALID, VISIBLE, and UNLOCKED
        const canDrawOnActiveLayer = activeLayer && activeLayer.visible && !activeLayer.locked;

        if (shouldDraw && canDrawOnActiveLayer) {
            canvas.selection = false;
            canvas.allowTouchScrolling = false;

            if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.touchAction = 'none';
            if (canvas.lowerCanvasEl) canvas.lowerCanvasEl.style.touchAction = 'none';

            canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
            canvas.isDrawingMode = true;

            // USE BRUSH MANAGER
            const config = getStartBrushConfig(activeBrushId);
            const runtimeConfig = {
                ...config,
                color: activeTool === 'eraser' ? 'white' : color,
                size: brushSize,
                opacity: opacity
            };

            CanvasBrushManager.configureBrush(canvas, runtimeConfig as any);

        } else {
            // Non-Drawing Mode OR Layer is Locked/Hidden
            const isShapeOrText = ['text', 'shape-rect', 'shape-ellipse', 'line', 'fill'].includes(activeTool);

            canvas.isDrawingMode = false;

            // If layer is locked/hidden, disable selection too unless we are just selecting? 
            // Actually, keep selection enabled for 'select' tool if broadly allowed, but objects are locked individually above.
            canvas.selection = !isShapeOrText && activeTool === 'select';

            canvas.allowTouchScrolling = true;
            if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.touchAction = 'pan-y';
            if (canvas.lowerCanvasEl) canvas.lowerCanvasEl.style.touchAction = 'pan-y';

            // Cursor Logic
            if (!canDrawOnActiveLayer && shouldDraw) {
                canvas.defaultCursor = 'not-allowed'; // Show forbidden cursor if trying to draw on locked layer
            } else if (activeTool === 'text') {
                canvas.defaultCursor = 'text';
            } else if (activeTool === 'fill') {
                canvas.defaultCursor = 'cell';
            } else if (activeTool.startsWith('shape-')) {
                canvas.defaultCursor = 'crosshair';
            } else {
                canvas.defaultCursor = 'default';
            }

            canvas.hoverCursor = activeTool === 'select' ? 'move' : canvas.defaultCursor;
        }
    };

    const onCanvasReady = (canvas: Canvas) => {
        fabricRef.current = canvas;

        // Init History
        history.current.push(JSON.stringify(canvas));
        console.log("Canvas initialized (Fresh - Image Load Disabled)");

        // Initial Config
        updateInteraction(canvas);

        // --- SHAPE & TEXT & FILL EVENT HANDLERS ---
        let isDrawingShape = false;
        let shapeOrigin = { x: 0, y: 0 };
        let activeShape: any = null;

        canvas.on('mouse:down', (opt) => {
            const tool = activeToolRef.current;
            if (!tool || tool === 'select' || tool === 'pan' || !isEditMode) return;

            const pointer = canvas.getScenePoint(opt.e);
            const layerId = activeLayerIdRef.current;

            // 1. TEXT TOOL
            if (tool === 'text') {
                if (!opt.target) { // Only create if not clicking on existing object
                    const text = new Textbox('Type here', {
                        left: pointer.x,
                        top: pointer.y,
                        fontSize: 20,
                        fontFamily: 'sans-serif',
                        fill: colorRef.current,
                        width: 150
                    });
                    // @ts-ignore
                    text.set('data', { layerId });
                    canvas.add(text);
                    canvas.setActiveObject(text);
                    text.enterEditing();
                    saveHistory(canvas);
                }
                return;
            }

            // 2. FILL TOOL (Vector Fill)
            if (tool === 'fill') {
                if (opt.target) {
                    // Fill the target object
                    // Check if it's a type we can fill (rect, circle, path, etc)
                    // Not grouping or image?
                    const t = opt.target;
                    // @ts-ignore
                    if (t.set && t.type !== 'image' && t.type !== 'group') {
                        t.set('fill', colorRef.current);
                        canvas.requestRenderAll();
                        saveHistory(canvas);
                    } else if (t.type === 'group') {
                        // Optional: Fill all children? Or just return.
                        // For Smart Bubbles, we might want to fill the shape.
                        // @ts-ignore
                        if (t.data?.type === 'smartBubble') {
                            // Find the shape (index 0 usually, or search)
                            // @ts-ignore
                            const shape = (t as Group).getObjects().find(o => o.type !== 'textbox');
                            if (shape) {
                                shape.set('fill', colorRef.current);
                                canvas.requestRenderAll();
                                saveHistory(canvas);
                            }
                        }
                    }
                }
                return;
            }

            // 3. SHAPE TOOLS (Rect, Ellipse, Line)
            if (tool === 'shape-rect' || tool === 'shape-ellipse' || tool === 'line') {
                isDrawingShape = true;
                shapeOrigin = { x: pointer.x, y: pointer.y };

                const commonProps = {
                    left: pointer.x,
                    top: pointer.y,
                    originX: 'left',
                    originY: 'top',
                    width: 0,
                    height: 0,
                    fill: tool === 'line' ? undefined : colorRef.current,
                    stroke: tool === 'line' ? colorRef.current : 'black',
                    strokeWidth: tool === 'line' ? brushSizeRef.current : 0,
                    selectable: true,
                    // @ts-ignore
                    data: { layerId }
                };

                if (tool === 'shape-rect') {
                    activeShape = new Rect(commonProps as any);
                } else if (tool === 'shape-ellipse') {
                    activeShape = new Ellipse({ ...commonProps, rx: 0, ry: 0 } as any);
                } else if (tool === 'line') {
                    // Line needs explicit coordinates [x1, y1, x2, y2]
                    activeShape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                        ...commonProps,
                        strokeLineCap: 'round',
                        strokeLineJoin: 'round',
                        fill: undefined // Lines don't have fill usually
                    } as any);
                }

                canvas.add(activeShape);
            }
        });

        canvas.on('mouse:move', (opt) => {
            if (!isDrawingShape || !activeShape) return;

            const pointer = canvas.getScenePoint(opt.e);

            if (activeToolRef.current === 'shape-rect') {
                const w = Math.abs(pointer.x - shapeOrigin.x);
                const h = Math.abs(pointer.y - shapeOrigin.y);

                activeShape.set({
                    width: w,
                    height: h,
                    // Handle negative direction
                    left: Math.min(pointer.x, shapeOrigin.x),
                    top: Math.min(pointer.y, shapeOrigin.y)
                });
            } else if (activeToolRef.current === 'shape-ellipse') {
                const rx = Math.abs(pointer.x - shapeOrigin.x) / 2;
                const ry = Math.abs(pointer.y - shapeOrigin.y) / 2;

                activeShape.set({
                    rx: rx,
                    ry: ry,
                    left: Math.min(pointer.x, shapeOrigin.x),
                    top: Math.min(pointer.y, shapeOrigin.y),
                    originX: 'left',
                    originY: 'top',
                    width: rx * 2,
                    height: ry * 2
                });
            } else if (activeToolRef.current === 'line') {
                // Update line end point
                activeShape.set({
                    x2: pointer.x,
                    y2: pointer.y
                });
                // Force re-calc
                activeShape.setCoords();
            }

            canvas.requestRenderAll();
        });

        canvas.on('mouse:up', () => {
            if (isDrawingShape) {
                isDrawingShape = false;
                // Finalize shape
                if (activeShape) {
                    activeShape.setCoords();
                    canvas.setActiveObject(activeShape);
                    saveHistory(canvas);
                }
                activeShape = null;
            }
        });

        // Listeners
        canvas.off('path:created');
        canvas.on('path:created', (e: any) => {
            console.log("Path created. Total Objects:", canvas.getObjects().length);

            const path = e.path;
            if (path) {
                // Assign to active layer
                // @ts-ignore
                path.set('data', { ...path.data, layerId: activeLayerIdRef.current });

                // Immediately respect visibility
                const currentLayer = layersRef.current.find(l => l.id === activeLayerIdRef.current);
                if (currentLayer) {
                    path.visible = currentLayer.visible;
                }
            }

            // G-PEN LOGIC REMOVED - Drawing is now freehand.
            // Explicit 'Line' tool handles straight lines.

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

    const isActive = activePage === pageId;
    const isActiveEdit = isActive && isEditMode;

    return (
        <div
            className="relative"
            style={{ width, height }}
            onClick={() => setActivePage(pageId)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            {/* Page Number Badge */}
            <div
                className={`
                    absolute -left-10 top-0
                    text-xs font-bold px-2 py-1 rounded
                    transition-colors duration-200
                    ${isActive ? 'text-cyan-400 bg-zinc-800' : 'text-zinc-600'}
                `}
            >
                {pageId}
            </div>

            {/* Canvas Container - Clean White */}
            <div
                className={`
                    w-full h-full bg-white
                    transition-shadow duration-200
                    ${isActiveEdit
                        ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-zinc-900'
                        : isActive
                            ? 'shadow-lg'
                            : 'shadow-md'}
                `}
                style={{
                    touchAction: isDrawingModeActive ? 'none' : 'pan-y'
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
