import { Canvas, Rect, Path, Point, util, FabricObject } from 'fabric';

export type SelectionType = 'rectangle' | 'lasso';

export interface SelectionBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface SelectionState {
    type: SelectionType;
    isActive: boolean;
    object: FabricObject | null;
}

export class SelectionManager {
    private canvas: Canvas;
    private selectionState: SelectionState = {
        type: 'rectangle',
        isActive: false,
        object: null
    };

    // Configuration
    private overlayColor = 'rgba(0, 160, 255, 0.1)';
    private strokeColor = 'rgba(0, 160, 255, 0.8)';
    private dashArray = [5, 5];

    private onSelectionChange?: (hasSelection: boolean, bounds: SelectionBounds | null) => void;
    private lastBounds: SelectionBounds | null = null;

    constructor(canvas: Canvas, onSelectionChange?: (hasSelection: boolean, bounds: SelectionBounds | null) => void) {
        this.canvas = canvas;
        this.onSelectionChange = onSelectionChange;

        // Listen to render events to update UI tracking during Pan/Zoom
        this.canvas.on('after:render', this.handleRender);
    }

    public dispose() {
        this.canvas.off('after:render', this.handleRender);
    }

    private handleRender = () => {
        // If we represent a selection (but assume drawing handles its own updates, or we want to track while drawing?)
        // To avoid flickering during draw, we might skip updates if isActive is true.
        if (this.selectionState.isActive) return;

        // Update bounds if we have a selection object
        if (this.selectionState.object) {
            this.notifyChange();
        }
    }

    public startSelection(type: SelectionType, pointer: { x: number, y: number }) {
        // Clear existing selection first
        this.clearSelection();

        this.selectionState.type = type;
        this.selectionState.isActive = true;

        if (type === 'rectangle') {
            const rect = new Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: this.overlayColor,
                stroke: this.strokeColor,
                strokeWidth: 1,
                strokeDashArray: this.dashArray,
                selectable: false,
                evented: false,
                excludeFromExport: true, // Don't save to history/JSON
                hoverCursor: 'default'
            });
            // @ts-ignore
            rect.isSelectionMask = true;

            this.selectionState.object = rect;
            this.canvas.add(rect);
        }
        // NOTE: We do NOT notify change here to avoid showing UI with 0 size or flickering.
        // UI will appear on finishSelection.
    }

    public updateSelection(pointer: { x: number, y: number }) {
        if (!this.selectionState.isActive || !this.selectionState.object) return;

        if (this.selectionState.type === 'rectangle') {
            const rect = this.selectionState.object as Rect;
            // Simple drag from top-left logic for now
            const w = pointer.x - rect.left;
            const h = pointer.y - rect.top;

            rect.set({ width: w, height: h });
        }
    }

    // Alternative update method that takes explicit bounds
    public updateRectBounds(left: number, top: number, width: number, height: number) {
        if (this.selectionState.type !== 'rectangle' || !this.selectionState.object) return;

        this.selectionState.object.set({
            left, top, width, height
        });
        this.selectionState.object.setCoords();
    }

    public finishSelection() {
        this.selectionState.isActive = false;
        if (this.selectionState.object) {
            this.selectionState.object.setCoords();
            this.canvas.requestRenderAll();
            // Force notification now that selection is done
            this.notifyChange();
        }
    }

    public clearSelection() {
        if (this.selectionState.object) {
            this.canvas.remove(this.selectionState.object);
            this.selectionState.object = null;
        }
        this.selectionState.isActive = false;
        this.canvas.requestRenderAll();

        // Cleanup backups
        this.canvas.getObjects().forEach(obj => {
            // @ts-ignore
            if (obj.isSelectionMask) {
                this.canvas.remove(obj);
            }
        });

        this.lastBounds = null; // Reset
        this.notifyChange();
    }

    private notifyChange() {
        if (!this.onSelectionChange) return;

        const hasSelection = !!this.selectionState.object;
        const bounds = this.getSelectionBounds();

        // Diff check to minimize React updates
        if (!this.lastBounds && !bounds) return;

        if ((!this.lastBounds && bounds) || (this.lastBounds && !bounds)) {
            this.lastBounds = bounds;
            this.onSelectionChange(hasSelection, bounds);
            return;
        }

        if (this.lastBounds && bounds) {
            if (Math.abs(this.lastBounds.left - bounds.left) > 0.5 ||
                Math.abs(this.lastBounds.top - bounds.top) > 0.5 ||
                Math.abs(this.lastBounds.width - bounds.width) > 0.5 ||
                Math.abs(this.lastBounds.height - bounds.height) > 0.5) {

                this.lastBounds = bounds;
                this.onSelectionChange(hasSelection, bounds);
            }
        }
    }

    // Returns bounds in SCREEN coordinates (relative to canvas element)
    public getSelectionBounds(): SelectionBounds | null {
        if (!this.selectionState.object) return null;
        const o = this.selectionState.object;

        // World bounds
        const left = o.left + (o.width < 0 ? o.width : 0);
        const top = o.top + (o.height < 0 ? o.height : 0);
        const width = Math.abs(o.getScaledWidth());
        const height = Math.abs(o.getScaledHeight());

        if (!this.canvas.viewportTransform) {
            return { left, top, width, height };
        }

        // Transform to screen coords for UI positioning
        // We use the 4 corners to be robust against any transform
        const tl = util.transformPoint(new Point(left, top), this.canvas.viewportTransform);
        const br = util.transformPoint(new Point(left + width, top + height), this.canvas.viewportTransform);

        // Handle flipped cases if rotation exists (simple min/max)
        const screenLeft = Math.min(tl.x, br.x);
        const screenTop = Math.min(tl.y, br.y);
        const screenWidth = Math.abs(br.x - tl.x);
        const screenHeight = Math.abs(br.y - tl.y);

        return { left: screenLeft, top: screenTop, width: screenWidth, height: screenHeight };
    }

    public hasSelection(): boolean {
        return !!this.selectionState.object;
    }

    public getSelectionObject(): FabricObject | null {
        return this.selectionState.object;
    }

    public isPointInSelection(point: { x: number, y: number }): boolean {
        if (!this.selectionState.object) return false;
        return this.selectionState.object.containsPoint(point as Point);
    }

    // --- MASK GENERATION ---
    public getMaskDataURL(): string {
        if (!this.selectionState.object) return '';

        const width = this.canvas.width || 800;
        const height = this.canvas.height || 1200;

        const tempCanvasEl = document.createElement('canvas');
        tempCanvasEl.width = width;
        tempCanvasEl.height = height;

        const ctx = tempCanvasEl.getContext('2d');
        if (!ctx) return '';

        // Black BG (Protected)
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        // White Selection (Editable)
        ctx.fillStyle = 'white';

        const o = this.selectionState.object;

        if (o instanceof Rect) {
            // Use WORLD coordinates for mask generation (must match pixels)
            let rx = o.left;
            let ry = o.top;
            let rw = o.getScaledWidth();
            let rh = o.getScaledHeight();

            if (rw < 0) { rx += rw; rw = Math.abs(rw); }
            if (rh < 0) { ry += rh; rh = Math.abs(rh); }

            ctx.fillRect(rx, ry, rw, rh);
        }

        return tempCanvasEl.toDataURL('image/png');
    }
}
