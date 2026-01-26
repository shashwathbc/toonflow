import { Canvas, PencilBrush, CircleBrush, SprayBrush } from 'fabric';
import { BrushConfig } from '@/config/brushRegistry';

export class CanvasBrushManager {
    static configureBrush(canvas: Canvas, config: BrushConfig & { color?: string }) {
        if (!canvas) return;

        let brush: any = canvas.freeDrawingBrush;

        // 1. SELECT BRUSH INSTANCE
        if (config.category === 'airbrush' || config.engine === 'raster') {
            if (!(brush instanceof SprayBrush)) {
                brush = new SprayBrush(canvas);
            }
        } else if (config.category === 'watercolor') {
            // Basic watercolor simulation using CircleBrush for now
            if (!(brush instanceof CircleBrush)) {
                brush = new CircleBrush(canvas);
            }
        } else if (config.category === 'eraser' || (config as any).color === 'white') {
            // Use EraserBrush if available in Fabric (v6+ usually has it, but name might vary or check docs)
            // If not standard export, we might need 'new PencilBrush(canvas)' with globalCompositeOperation?
            // Fabric v6 usually relies on PencilBrush with globalCompositeOperation = 'destination-out' for eraser on standard canvas,
            // OR specific EraserBrush if installed. 
            // Let's assume standard behavior: PencilBrush with erase mode logic if simple, 
            // but here let's try to use PencilBrush with white color or specific if imported.
            // Simplest "Eraser" in Fabric vector canvas is removing objects.
            // BUT for "Brush Eraser", we use a white brush (if background white) OR destination-out.

            // Check if we can use 'EraserBrush' (often not in main 'fabric' package directly unless beta).
            // Fallback: PencilBrush
            if (!(brush instanceof PencilBrush)) {
                brush = new PencilBrush(canvas);
            }
        } else {
            // Default Vector Brush (Pencil/Pen)
            if (!(brush instanceof PencilBrush)) {
                brush = new PencilBrush(canvas);
            }
        }

        // 2. APPLY PROPERTIES
        brush.width = config.size;

        // Handle Eraser specifically
        if (config.category === 'eraser') {
            brush.color = 'white'; // Simple eraser
            // prevent anti-aliasing artifacts if possible?
        } else {
            brush.color = this.formatColor(config.color || 'black', config.opacity);
        }

        // Stabilization (Decimate) - Fabric 'decimate' property on PencilBrush
        // Higher decimate = more smoothing (points removal)
        if (brush instanceof PencilBrush) {
            // Map stabilization 0-100 to decimate 0-10 generally
            // But Fabric decimate implies 'pixel distance to skip'.
            brush.decimate = (config.stabilization || 0) / 10;
        }

        // Fabric specific property mapping
        if (brush instanceof SprayBrush) {
            // Mapping "Flow" to density/dot width if possible, or opacity
            // SprayBrush specific: density, dotWidth, dotWidthVariance, etc.
            // Simplified mapping:
            (brush as any).density = config.flow || 20;
            (brush as any).dotWidth = Math.max(1, config.size / 5);
        }

        // 3. SET TO CANVAS
        canvas.freeDrawingBrush = brush;

        // Shadow / Hardness simulation
        // Hardness < 100 could simulate shadowBlur
        if (config.hardness < 100 && !(brush instanceof SprayBrush) && config.category !== 'eraser') {
            brush.shadow = {
                blur: (100 - config.hardness) * 0.5,
                color: brush.color,
                offsetX: 0,
                offsetY: 0
            };
        } else {
            brush.shadow = null;
        }
    }

    private static formatColor(baseColor: string, opacity: number): string {
        // Convert Hex to RGBA if needed
        // Assume baseColor is Hex (#RRGGBB)
        if (baseColor.startsWith('#')) {
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            // Opacity is 0-100 in config? or 0-1?
            // Store says 100 default. So /100.
            const a = opacity > 1 ? opacity / 100 : opacity;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return baseColor;
    }
}
