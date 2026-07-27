'use client'

import React, { useState } from 'react'
import {
  MousePointer2,
  Hand,
  Frame,
  Type,
  Square,
  Circle,
  Paintbrush,
  Eraser,
  Sparkles,
  Undo2,
  Redo2,
} from 'lucide-react'
import { useEditorStore, type ToolId } from '@/store/useEditorStore'
import { cn } from '@/lib/utils/cn'
import { BrushPanel } from '@/components/editor/BrushPanel'
import { TextToolMenu } from '@/components/editor/TextToolMenu'

const TOOLS: { id: ToolId; icon: typeof MousePointer2; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Move', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  { id: 'frame', icon: Frame, label: 'Frame / Page', key: 'F' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', key: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
]

export function TopToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const setBrushPanelOpen = useEditorStore((s) => s.setBrushPanelOpen)
  const toggleBrushPanel = useEditorStore((s) => s.toggleBrushPanel)
  const [textMenuOpen, setTextMenuOpen] = useState(false)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  const setRightTab = useEditorStore((s) => s.setRightTab)

  return (
    <>
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-[#1B1B1B]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[#2E2E2E] px-1.5 py-1.5">
      {TOOLS.map((t) => {
        const isPaint = t.id === 'brush' || t.id === 'eraser'
        return (
        <button
          key={t.id}
          onClick={() => {
            if (isPaint) {
              // Clicking the already-active paint tool toggles its panel;
              // switching to it (re)opens the panel.
              if (activeTool === t.id) toggleBrushPanel()
              else { setActiveTool(t.id); setBrushPanelOpen(true) }
            } else if (t.id === 'text') {
              // The Text tool opens a dropdown of text + speech-bubble formats.
              setActiveTool('text')
              setTextMenuOpen(activeTool === 'text' ? !textMenuOpen : true)
            } else {
              setActiveTool(t.id)
            }
          }}
          title={`${t.label}  ·  ${t.key}`}
          aria-label={t.label}
          aria-pressed={activeTool === t.id}
          className={cn(
            'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]',
            activeTool === t.id ? 'bg-[#4C9AFF] text-white' : 'text-white/60 hover:text-white hover:bg-white/10',
          )}
        >
          <t.icon size={18} />
        </button>
        )
      })}

      <div className="w-px h-6 bg-[#2E2E2E] mx-1" />

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo · Ctrl+Z"
        aria-label="Undo"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <Undo2 size={17} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo · Ctrl+Shift+Z"
        aria-label="Redo"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <Redo2 size={17} />
      </button>

      <div className="w-px h-6 bg-[#2E2E2E] mx-1" />

      <button
        onClick={() => setRightTab('assistant')}
        title="AI Assistant"
        aria-label="Open AI assistant"
        className="h-9 pl-2.5 pr-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#4C9AFF]/20 to-[#A855F7]/20 text-white hover:from-[#4C9AFF]/30 hover:to-[#A855F7]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <Sparkles size={16} className="text-[#4C9AFF]" />
        <span className="text-xs font-semibold">AI</span>
      </button>
    </div>
    <BrushPanel />
    {textMenuOpen && <TextToolMenu onPick={() => setTextMenuOpen(false)} />}
    </>
  )
}
