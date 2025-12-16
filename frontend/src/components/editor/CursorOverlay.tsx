import React, { useEffect, useRef, useState } from 'react';

interface CursorOverlayProps {
    activeTool: string;
    brushSize: number;
    color: string;
    opacity: number;
    isEditMode: boolean;
    isActive: boolean; // True when mouse is over canvas
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
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only track if needed
        if (!isEditMode) return;

        const moveCursor = (e: MouseEvent) => {
            if (cursorRef.current) {
                // Use clientX/Y for fixed overlay or pageX/Y for absolute?
                // We'll use fixed positioning for the overlay container usually, so client coordinates work.
                cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
            }
        };

        const handleEnter = () => setIsVisible(true);
        const handleLeave = () => setIsVisible(false);

        window.addEventListener('mousemove', moveCursor);

        // We rely on parent passing 'isActive' or we can detect elementFromPoint?
        // User requirement: "Edit Mode cursor toggle logic". 
        // Ideally, we only show this when hovering the canvas. relying on `isActive` prop is safer React-way.

        return () => {
            window.removeEventListener('mousemove', moveCursor);
        };
    }, [isEditMode]);

    if (!isEditMode || !isActive) return null;

    // Render different cursors based on tool
    const renderCursorContent = () => {
        switch (activeTool) {
            case 'brush':
            case 'pen':
                return (
                    <div
                        className="rounded-full border-2 transition-all duration-75 ease-out"
                        style={{
                            width: `${brushSize}px`,
                            height: `${brushSize}px`,
                            borderColor: color, // Ensure contrast? Or just use user color
                            backgroundColor: activeTool === 'brush' ? `${color}${Math.round(opacity * 2.55).toString(16).padStart(2, '0').slice(0, 2)}33` : undefined, // Faint tint
                            boxShadow: '0 0 2px 1px rgba(255,255,255,0.8)' // Contrast ring
                        }}
                    />
                );
            case 'eraser':
                return (
                    <div
                        className="rounded-full border-2 border-white bg-black/10 shadow-[0_0_2px_1px_rgba(0,0,0,0.5)]"
                        style={{
                            width: `${brushSize}px`,
                            height: `${brushSize}px`,
                        }}
                    />
                );
            case 'picker':
                return (
                    <div className="relative">
                        <span className="text-2xl drop-shadow-md">🧴</span>
                        {/* Preview window? */}
                        <div
                            className="absolute top-[-20px] right-[-20px] w-6 h-6 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: color }}
                        />
                    </div>
                );
            case 'crop':
                return (
                    <div className="w-8 h-8 relative">
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-black/80 -translate-y-1/2 shadow-sm" />
                        <div className="absolute left-1/2 top-0 h-full w-[2px] bg-black/80 -translate-x-1/2 shadow-sm" />
                    </div>
                );
            default:
                return null; // Fallback to system cursor usually, or loop?
        }
    };

    const content = renderCursorContent();
    if (!content) return null;

    return (
        <div
            ref={cursorRef}
            className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-normal"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                // Initial opaque position, hidden until moved?
            }}
        >
            {content}
        </div>
    );
};

export default CursorOverlay;
