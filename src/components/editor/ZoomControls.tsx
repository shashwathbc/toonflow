'use client'

import React from 'react'
import { Plus, Minus, Maximize2 } from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'

/**
 * Floating zoom widget pinned to the canvas (bottom-left). Gives every device a
 * reliable way to zoom — especially phones/tablets, where a two-finger pinch can
 * be swallowed by the browser's own gesture recognizer. Buttons zoom toward the
 * viewport centre via the store's tested zoom actions; the readout taps back to
 * 100%, and the fit button frames every page.
 */
export function ZoomControls() {
  const scale = useEditorStore((s) => s.viewport.scale)
  const zoomIn = useEditorStore((s) => s.zoomIn)
  const zoomOut = useEditorStore((s) => s.zoomOut)
  const actualSize = useEditorStore((s) => s.actualSize)
  const fitAll = useEditorStore((s) => s.fitAll)

  const pct = Math.round(scale * 100)

  const btn =
    'w-10 h-10 flex items-center justify-center text-white/70 hover:text-white active:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4C9AFF] disabled:opacity-30'

  return (
    <div
      className="absolute bottom-4 left-4 z-30 flex items-center rounded-xl bg-[#1B1B1B]/95 backdrop-blur-xl border border-[#2E2E2E] shadow-2xl overflow-hidden"
      role="group"
      aria-label="Zoom controls"
    >
      <button type="button" onClick={() => zoomOut()} aria-label="Zoom out" className={btn}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => actualSize()}
        aria-label={`Zoom ${pct} percent. Reset to 100%`}
        title="Reset to 100%"
        className="min-w-[3.25rem] h-10 px-1 text-xs font-semibold tabular-nums text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4C9AFF]"
      >
        {pct}%
      </button>
      <button type="button" onClick={() => zoomIn()} aria-label="Zoom in" className={btn}>
        <Plus size={18} aria-hidden="true" />
      </button>
      <div className="w-px h-6 bg-[#2E2E2E]" aria-hidden="true" />
      <button type="button" onClick={() => fitAll()} aria-label="Fit all pages to screen" title="Fit to screen" className={btn}>
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
