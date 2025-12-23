import React, { useEffect, useState } from 'react';
import TopToolbar from './TopToolbar';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import CanvasArea from './CanvasArea';
import './ResizableLayout.css';

// Utility functions
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const restore = (key: string, defaultValue: number): number => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved, 10) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const save = (key: string, value: number) => {
  try {
    localStorage.setItem(key, value.toString());
  } catch (e) {
    console.warn('Failed to save layout width:', e);
  }
};

type ResizableLayoutProps = {
  onBack: () => void;
  onSave: () => void;
  onExport: () => void;
  onExportZIP?: () => void;
  onExportPDF?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  // Prop drill for CursorOverlay
  brushSize: number;
  opacity: number;
  color: string;
  activeTool: string;
} & React.ComponentProps<typeof LeftSidebar> &
  React.ComponentProps<typeof RightSidebar> &
  React.ComponentProps<typeof CanvasArea>;

const MIN_LEFT = 200;
const MAX_LEFT = 480;
const MIN_RIGHT = 220;
const MAX_RIGHT = 560;
const DEFAULT_LEFT = 280;
const DEFAULT_RIGHT = 320;

export default function ResizableLayout(props: ResizableLayoutProps) {
  const {
    onBack, onSave, onExport, onExportZIP, onExportPDF,
    isEditMode, setIsEditMode,
    onUndo, onRedo, canUndo, canRedo,
    brushSize, opacity, color, activeTool,
    ...restProps
  } = props;
  const [leftW, setLeftW] = useState<number>(() => restore('layout:leftWidth', DEFAULT_LEFT));
  const [rightW, setRightW] = useState<number>(() => restore('layout:rightWidth', DEFAULT_RIGHT));
  const [isDragging, setIsDragging] = useState(false);

  // Update CSS variables whenever widths change
  useEffect(() => {
    document.documentElement.style.setProperty('--left', `${leftW}px`);
    document.documentElement.style.setProperty('--right', `${rightW}px`);
  }, [leftW, rightW]);

  // Set up dragging styles
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

  const startDragLeft = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = e.clientX;
    const start = leftW;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const move = (ev: PointerEvent) => {
      const next = clamp(start + (ev.clientX - startX), MIN_LEFT, MAX_LEFT);
      document.documentElement.style.setProperty('--left', `${next}px`);
    };

    const up = () => {
      const finalPx = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--left'), 10);
      setLeftW(finalPx);
      save('layout:leftWidth', finalPx);
      setIsDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDragRight = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = e.clientX;
    const start = rightW;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const move = (ev: PointerEvent) => {
      const delta = startX - ev.clientX; // dragging left increases right width
      const next = clamp(start + delta, MIN_RIGHT, MAX_RIGHT);
      document.documentElement.style.setProperty('--right', `${next}px`);
    };

    const up = () => {
      const finalPx = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--right'), 10);
      setRightW(finalPx);
      save('layout:rightWidth', finalPx);
      setIsDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="resizable-layout">
      <div className="col-span-5 row-[1]">
        <TopToolbar
          onBack={onBack}
          onSave={onSave}
          onExport={onExport}
          onExportZIP={onExportZIP}
          onExportPDF={onExportPDF}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      {/* Row 2: main content with sashes */}
      <div className="row-[2] col-[1] border-r" id="left-sidebar">
        <div className="sidebar-container">
          <LeftSidebar
            {...restProps}
            activeTool={activeTool}
            brushSize={brushSize}
            opacity={opacity}
            color={color}
          />
        </div>
      </div>

      <div
        className="sash row-[2] col-[2]"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize left sidebar"
        aria-controls="left-sidebar"
        tabIndex={0}
        onDoubleClick={() => {
          setLeftW(DEFAULT_LEFT);
          save('layout:leftWidth', DEFAULT_LEFT);
        }}
        onPointerDown={startDragLeft}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft')
            setLeftW((w) => {
              const next = clamp(w - (e.shiftKey ? 50 : 10), MIN_LEFT, MAX_LEFT);
              save('layout:leftWidth', next);
              return next;
            });
          if (e.key === 'ArrowRight')
            setLeftW((w) => {
              const next = clamp(w + (e.shiftKey ? 50 : 10), MIN_LEFT, MAX_LEFT);
              save('layout:leftWidth', next);
              return next;
            });
        }}
      />

      <div className="row-[2] col-[3]">
        <div className="canvas-container">
          <CanvasArea
            {...restProps}
            editingPage={restProps.editingPage}
            setEditingPage={restProps.setEditingPage}
            // Add cursor props
            isEditMode={isEditMode}
            brushSize={brushSize}
            opacity={opacity}
            color={color}
            activeTool={activeTool}
          />
        </div>
      </div>

      <div
        className="sash row-[2] col-[4]"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize right sidebar"
        aria-controls="right-sidebar"
        tabIndex={0}
        onDoubleClick={() => {
          setRightW(DEFAULT_RIGHT);
          save('layout:rightWidth', DEFAULT_RIGHT);
        }}
        onPointerDown={startDragRight}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft')
            setRightW((w) => {
              const next = clamp(w + (e.shiftKey ? 50 : 10), MIN_RIGHT, MAX_RIGHT);
              save('layout:rightWidth', next);
              return next;
            });
          if (e.key === 'ArrowRight')
            setRightW((w) => {
              const next = clamp(w - (e.shiftKey ? 50 : 10), MIN_RIGHT, MAX_RIGHT);
              save('layout:rightWidth', next);
              return next;
            });
        }}
      />

      <div className="row-[2] col-[5] border-l" id="right-sidebar">
        <div className="sidebar-container">
          <RightSidebar {...restProps} />
        </div>
      </div>
    </div>
  );
}