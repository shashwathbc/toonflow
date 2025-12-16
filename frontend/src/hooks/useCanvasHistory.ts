import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from 'fabric';

interface UseCanvasHistoryReturn {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    saveHistory: () => void;
}

export const useCanvasHistory = (canvas: Canvas | null): UseCanvasHistoryReturn => {
    const [history, setHistory] = useState<string[]>([]);
    const [historyStep, setHistoryStep] = useState<number>(-1);
    const lockedRef = useRef(false);

    // Initial save
    useEffect(() => {
        if (!canvas) return;
        // Save initial state
        if (historyStep === -1) {
            const json = JSON.stringify(canvas.toJSON());
            setHistory([json]);
            setHistoryStep(0);
        }
    }, [canvas]);

    const saveHistory = useCallback(() => {
        if (!canvas || lockedRef.current) return;

        const json = JSON.stringify(canvas.toJSON());

        setHistory((prev) => {
            const newHistory = prev.slice(0, historyStep + 1);
            if (newHistory[newHistory.length - 1] === json) return newHistory; // No change
            newHistory.push(json);
            return newHistory;
        });
        setHistoryStep((prev) => prev + 1);
    }, [canvas, historyStep]);

    const undo = useCallback(() => {
        if (!canvas || historyStep <= 0) return;

        lockedRef.current = true;
        const prevStep = historyStep - 1;
        const json = history[prevStep];

        canvas.loadFromJSON(JSON.parse(json)).then(() => {
            canvas.renderAll();
            setHistoryStep(prevStep);
            lockedRef.current = false;
        });
    }, [canvas, history, historyStep]);

    const redo = useCallback(() => {
        if (!canvas || historyStep >= history.length - 1) return;

        lockedRef.current = true;
        const nextStep = historyStep + 1;
        const json = history[nextStep];

        canvas.loadFromJSON(JSON.parse(json)).then(() => {
            canvas.renderAll();
            setHistoryStep(nextStep);
            lockedRef.current = false;
        });
    }, [canvas, history, historyStep]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z' || e.key === 'Z'))) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [undo, redo]);

    // Attach listeners
    useEffect(() => {
        if (!canvas) return;

        const handleSave = () => saveHistory();

        // Track standard fabric events
        canvas.on('object:added', handleSave);
        canvas.on('object:modified', handleSave);
        canvas.on('object:removed', handleSave);

        return () => {
            canvas.off('object:added', handleSave);
            canvas.off('object:modified', handleSave);
            canvas.off('object:removed', handleSave);
        };
    }, [canvas, saveHistory]);

    return {
        undo,
        redo,
        canUndo: historyStep > 0,
        canRedo: historyStep < history.length - 1,
        saveHistory
    };
};
