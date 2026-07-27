'use client'

import { X } from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'
import { BRUSH_PRESETS } from '@/lib/editor/brush/presets'
import { cn } from '@/lib/utils/cn'

const pct = (v: number) => `${Math.round(v * 100)}%`

function Slider({
  label, value, min, max, step, onChange, fmt,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-white/50 w-16 shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#4C9AFF] cursor-pointer"
        aria-label={label}
      />
      <span className="text-[11px] text-white/40 tabular-nums w-10 text-right">{fmt(value)}</span>
    </div>
  )
}

/**
 * Floating brush settings, shown only while the Brush or Eraser tool is active.
 * Every control writes straight to the store's live `brush`, so the next stroke
 * picks it up instantly.
 */
export function BrushPanel() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const brushPanelOpen = useEditorStore((s) => s.brushPanelOpen)
  const setBrushPanelOpen = useEditorStore((s) => s.setBrushPanelOpen)
  const brush = useEditorStore((s) => s.brush)
  const activeBrushId = useEditorStore((s) => s.activeBrushId)
  const applyBrushPreset = useEditorStore((s) => s.applyBrushPreset)
  const setBrush = useEditorStore((s) => s.setBrush)
  const setBrushColor = useEditorStore((s) => s.setBrushColor)

  if (activeTool !== 'brush' && activeTool !== 'eraser') return null
  if (!brushPanelOpen) return null
  const isEraser = activeTool === 'eraser'

  return (
    <div className="absolute top-4 left-3 z-30 w-[280px] bg-[#1B1B1B]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[#2E2E2E] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
          {isEraser ? 'Eraser' : 'Brush'}
        </span>
        <button
          type="button"
          onClick={() => setBrushPanelOpen(false)}
          aria-label="Close brush settings"
          title="Close (click the tool again to reopen)"
          className="p-1 -mr-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]"
        >
          <X size={13} />
        </button>
      </div>

      {/* preset chips */}
      <div className="flex flex-wrap gap-1">
        {BRUSH_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyBrushPreset(p.id)}
            aria-pressed={activeBrushId === p.id}
            className={cn(
              'text-[11px] px-2 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]',
              activeBrushId === p.id
                ? 'bg-[#4C9AFF] border-[#4C9AFF] text-white'
                : 'border-[#2E2E2E] text-white/55 hover:text-white hover:border-white/30',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* ink color */}
      {!isEraser && (
        <div className="flex items-center gap-2">
          <label htmlFor="brush-color" className="text-[11px] text-white/50 w-16 shrink-0">Color</label>
          <input
            id="brush-color"
            type="color"
            value={brush.color}
            onChange={(e) => setBrushColor(e.target.value)}
            className="h-7 w-10 rounded bg-transparent cursor-pointer"
            aria-label="Brush color"
          />
          <span className="text-[11px] text-white/40 tabular-nums uppercase">{brush.color}</span>
        </div>
      )}

      {/* dynamics */}
      <Slider label="Size" value={brush.size} min={1} max={200} step={1} onChange={(v) => setBrush({ size: v })} fmt={(v) => `${Math.round(v)}px`} />
      <Slider label="Hardness" value={brush.hardness} min={0} max={1} step={0.01} onChange={(v) => setBrush({ hardness: v })} fmt={pct} />
      <Slider label="Opacity" value={brush.opacity} min={0.02} max={1} step={0.01} onChange={(v) => setBrush({ opacity: v })} fmt={pct} />
      <Slider label="Flow" value={brush.flow} min={0.02} max={1} step={0.01} onChange={(v) => setBrush({ flow: v })} fmt={pct} />
      <Slider label="Spacing" value={brush.spacing} min={0.01} max={0.5} step={0.01} onChange={(v) => setBrush({ spacing: v })} fmt={pct} />
      <Slider label="Stabilizer" value={brush.stabilization} min={0} max={1} step={0.01} onChange={(v) => setBrush({ stabilization: v })} fmt={pct} />
    </div>
  )
}
