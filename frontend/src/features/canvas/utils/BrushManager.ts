import { Canvas, PencilBrush, CircleBrush, SprayBrush, PatternBrush } from 'fabric';
import { BrushConfig } from '@/config/brushRegistry';

export class CanvasBrushManager {
    static configureBrush(canvas: Canvas, config: BrushConfig) {
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
        } else {
            // Default Vector Brush (Pencil/Pen)
            if (!(brush instanceof PencilBrush)) {
                brush = new PencilBrush(canvas);
            }
        }

        // 2. APPLY PROPERTIES
        brush.width = config.size;
        brush.color = this.formatColor(canvas.freeDrawingBrush?.color || 'black', config.opacity);

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
        if (config.hardness < 100 && !(brush instanceof SprayBrush)) {
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

    private static formatColor(baseColor: string | any, opacity: number): string {
        // This is a naive implementation. 
        // Ideally we parse the color string and update the alpha channel.
        // Fabric brush.color takes a string. 
        // If the color is already rgba, we update A.
        // For now, relying on Fabric's internal handling or global opacity if distinct.
        return baseColor; // Placeholder
    }
}
