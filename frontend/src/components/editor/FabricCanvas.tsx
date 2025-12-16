import React, { useEffect, useRef } from 'react';
import { Canvas } from 'fabric';

interface FabricCanvasProps {
    onCanvasReady: (canvas: Canvas) => void;
    width?: number;
    height?: number;
    className?: string;
    style?: React.CSSProperties;
}

const FabricCanvas: React.FC<FabricCanvasProps> = ({
    onCanvasReady,
    width,
    height,
    className,
    style
}) => {
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<Canvas | null>(null);

    useEffect(() => {
        if (!canvasEl.current) return;

        // Initialize fabric canvas
        // We use a safe width/height default if not provided, though typically they should be.
        const canvas = new Canvas(canvasEl.current, {
            width: width || 800,
            height: height || 600,
            backgroundColor: 'rgba(0,0,0,0)', // Transparent by default so it overlays or can have bg set later
            selection: true, // Enable multiple selection
            preserveObjectStacking: true, // Easier for layering
        });

        fabricRef.current = canvas;
        onCanvasReady(canvas);

        return () => {
            // Cleanup
            canvas.dispose();
            fabricRef.current = null;
        };
    }, []);

    // Handle resizing dynamically
    useEffect(() => {
        if (fabricRef.current && width && height) {
            fabricRef.current.setWidth(width);
            fabricRef.current.setHeight(height);
            fabricRef.current.renderAll();
        }
    }, [width, height]);

    return <canvas ref={canvasEl} className={className} style={style} />;
};

export default FabricCanvas;
