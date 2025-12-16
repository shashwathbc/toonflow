import React, { useEffect, useRef, useState } from 'react';
import { Pen, Brush, Eraser, Pipette, Crop, MousePointer2 } from "lucide-react";

interface CursorOverlayProps {
    activeTool: string;
    brushSize: number;
    color: string;
    opacity: number;
    isEditMode: boolean;
    isActive: boolean;
}

const CursorOverlay: React.FC<CursorOverlayProps> = ({
    activeTool,
    brushSize,
    color,
    opacity,
    isEditMode,
    isActive
}) => {
    const cursorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isEditMode) return;
        const moveCursor = (e: MouseEvent) => {
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            }
        };
        window.addEventListener('mousemove', moveCursor);
        return () => window.removeEventListener('mousemove', moveCursor);
    }, [isEditMode]);

    if (!isEditMode || !isActive) return null;

    const renderCursorContent = () => {
        const commonStyle = {
            filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.5))',
            color: activeTool === 'eraser' ? '#ffffff' : color
        };

        switch (activeTool) {
            case 'pen':
                return (
                    // Pen tip is usually bottom-left. We shift it so bottom-left is at (0,0) relative to parent
                    <div className="relative -top-4 -left-[2px]">
                        <Pen size={24} style={commonStyle} fill="currentColor" />
                    </div>
                );
            case 'brush':
                return (
                    <div className="relative">
                        {/* Size indicator */}
                        <div
                            className="absolute border border-black/50 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ width: brushSize, height: brushSize, borderColor: color }}
                        />
                        {/* Icon */}
                        <div className="absolute -top-4 -left-1">
                            <Brush size={24} style={commonStyle} fill="currentColor" />
                        </div>
                    </div>
                );
            case 'eraser':
                return (
                    <div className="relative">
                        <div
                            className="absolute border-2 border-white bg-black/10 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ width: brushSize, height: brushSize }}
                        />
                        <div className="absolute -top-4 -left-1">
                            <Eraser size={24} className="text-white" fill="#000000" />
                        </div>
                    </div>
                );
            case 'picker':
                return (
                    <div className="relative -top-4 -left-4">
                        <Pipette size={24} style={commonStyle} />
                        <div
                            className="absolute top-0 right-[-10px] w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: color }}
                        />
                    </div>
                );
            case 'crop':
                return (
                    <div className="relative -top-3 -left-3">
                        <Crop size={24} className="text-white drop-shadow-md" />
                    </div>
                );
            default:
                return null;
        }
    };

    const content = renderCursorContent();
    if (!content) return null;

    return (
        <div
            ref={cursorRef}
            className="fixed top-0 left-0 pointer-events-none z-[9999]"
            style={{
                position: 'fixed'
            }}
        >
            {content}
        </div>
    );
};

export default CursorOverlay;
