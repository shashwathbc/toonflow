
import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';

export const useEditorShortcuts = () => {
    const {
        triggerUndo, triggerRedo, setActiveTool, activeTool,
        setBrushSize, brushSize
    } = useEditorStore();

    // Track previous tool for Space (Pan) toggle
    const previousToolRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA' ||
                (e.target as HTMLElement).isContentEditable) {
                return;
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    triggerRedo();
                } else {
                    triggerUndo();
                }
                return;
            }

            // Save (Mock)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                console.log("Save shortcut triggered");
                // Trigger save action if available
                return;
            }

            // Spacebar -> Pan (Hold)
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                if (activeTool !== 'pan') {
                    previousToolRef.current = activeTool;
                    setActiveTool('pan');
                }
            }

            // Brush Size
            if (e.key === '[') {
                setBrushSize(Math.max(1, brushSize - 2));
            }
            if (e.key === ']') {
                setBrushSize(Math.min(100, brushSize + 2));
            }

            // Tools
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'v': setActiveTool('select'); break;
                    case 'p': setActiveTool('pen'); break; // or 'pencil' depending on pref
                    case 'b': setActiveTool('paint'); break;
                    case 'e': setActiveTool('eraser'); break;
                    case 't': setActiveTool('text'); break;
                    case 'h': setActiveTool('pan'); break; // Hand
                    case 'l': setActiveTool('line'); break;
                    case 'g': setActiveTool('fill'); break; // Bucket
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Spacebar -> Revert Pan
            if (e.code === 'Space') {
                e.preventDefault();
                if (previousToolRef.current) {
                    setActiveTool(previousToolRef.current);
                    previousToolRef.current = null;
                } else if (activeTool === 'pan') {
                    // If we were in pan mode without a previous tool, usually default to select
                    setActiveTool('select');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [triggerUndo, triggerRedo, setActiveTool, activeTool, brushSize, setBrushSize]);
};
