'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  SlidersHorizontal,
  Sparkles,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  BringToFront,
  SendToBack,
  Layers,
  FileJson,
  ImageDown,
  Wand2,
  MessageSquareText,
  ScanText,
  Palette,
} from 'lucide-react'
import {
  useEditorStore,
  type RightTab,
  type EditorElement,
  type TextElement,
  type ShapeElement,
} from '@/store/useEditorStore'
import { exportPagePng, exportProjectJson } from '@/lib/editor/exportProject'
import { cn } from '@/lib/utils/cn'

const TABS: { id: RightTab; icon: typeof SlidersHorizontal; label: string }[] = [
  { id: 'properties', icon: SlidersHorizontal, label: 'Properties' },
  { id: 'assistant', icon: Sparkles, label: 'Assistant' },
  { id: 'export', icon: Download, label: 'Export' },
]

export function SidebarRight() {
  const rightTab = useEditorStore((s) => s.rightTab)
  const setRightTab = useEditorStore((s) => s.setRightTab)

  return (
    <aside className="h-full w-full flex flex-col bg-[#161616] border-l border-[#262626]">
      <div className="h-11 flex items-center px-1.5 gap-1 border-b border-[#262626] shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRightTab(t.id)}
            aria-pressed={rightTab === t.id}
            className={cn(
              'flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]',
              rightTab === t.id ? 'bg-[#262626] text-white' : 'text-white/45 hover:text-white hover:bg-white/5',
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333]">
        {rightTab === 'properties' && <PropertiesTab />}
        {rightTab === 'assistant' && <AssistantTab />}
        {rightTab === 'export' && <ExportTab />}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3 border-b border-[#222] space-y-2.5">
      <label className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">{title}</label>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number, commit: boolean) => void
}) {
  const [local, setLocal] = useState(String(Math.round(value)))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setLocal(String(Math.round(value)))
  }, [value])
  return (
    <div className="flex items-center bg-[#1E1E1E] rounded-md border border-[#2E2E2E] focus-within:border-[#4C9AFF] overflow-hidden">
      <span className="text-[10px] text-white/40 px-2 py-1.5 border-r border-[#2E2E2E] select-none">{label}</span>
      <input
        type="number"
        value={local}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setLocal(e.target.value)
          const n = parseFloat(e.target.value)
          if (!isNaN(n)) onChange(n, false)
        }}
        onBlur={() => {
          focused.current = false
          const n = parseFloat(local)
          if (!isNaN(n)) onChange(n, true)
          else setLocal(String(Math.round(value)))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          e.stopPropagation()
        }}
        className="w-full bg-transparent px-2 py-1.5 text-xs text-white outline-none"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative w-7 h-7 rounded-md border border-[#2E2E2E] overflow-hidden shrink-0 cursor-pointer">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={label}
        />
      </label>
      <span className="text-xs text-white/70 flex-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-20 bg-[#1E1E1E] rounded-md border border-[#2E2E2E] focus:border-[#4C9AFF] outline-none px-2 py-1 text-[11px] font-mono text-white"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
function PropertiesTab() {
  const pages = useEditorStore((s) => s.pages)
  const selIds = useEditorStore((s) => s.selectedElementIds)
  const selectedPageId = useEditorStore((s) => s.selectedPageId)
  const updateSelected = useEditorStore((s) => s.updateSelected)
  const updatePage = useEditorStore((s) => s.updatePage)
  const moveZ = useEditorStore((s) => s.moveZ)

  const primary = (() => {
    for (const p of pages) {
      const el = p.elements.find((e) => e.id === selIds[0])
      if (el) return { page: p, el }
    }
    return null
  })()

  // --- element selected ---
  if (primary) {
    const { page, el } = primary
    const set = (patch: Partial<EditorElement>, commit = true) => updateSelected(patch, commit)
    return (
      <div>
        <div className="px-3 py-2.5 border-b border-[#222] flex items-center gap-2">
          <span className="text-xs font-semibold text-white capitalize">
            {selIds.length > 1 ? `${selIds.length} elements` : el.type}
          </span>
        </div>

        <Section title="Position & size">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="X" value={el.x} onChange={(v, c) => set({ x: v }, c)} />
            <NumberField label="Y" value={el.y} onChange={(v, c) => set({ y: v }, c)} />
            <NumberField label="W" value={el.width} onChange={(v, c) => set({ width: v }, c)} />
            <NumberField label="H" value={el.height} onChange={(v, c) => set({ height: v }, c)} />
            <NumberField label="R°" value={el.rotation} onChange={(v, c) => set({ rotation: v }, c)} />
          </div>
        </Section>

        <Section title="Appearance">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70 flex-1">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={el.opacity}
              onChange={(e) => set({ opacity: parseFloat(e.target.value) }, false)}
              onPointerUp={() => set({ opacity: el.opacity }, true)}
              className="w-28 accent-[#4C9AFF]"
            />
            <span className="text-[11px] font-mono text-white/60 w-8 text-right">{Math.round(el.opacity * 100)}</span>
          </div>
          {(el.type === 'rect' || el.type === 'ellipse') && (
            <>
              <ColorField label="Fill" value={(el as ShapeElement).fill} onChange={(v) => set({ fill: v } as Partial<EditorElement>)} />
              <ColorField label="Stroke" value={(el as ShapeElement).stroke} onChange={(v) => set({ stroke: v } as Partial<EditorElement>)} />
              <div className="grid grid-cols-2 gap-1.5">
                <NumberField label="Border" value={(el as ShapeElement).strokeWidth} onChange={(v, c) => set({ strokeWidth: v } as Partial<EditorElement>, c)} />
                {el.type === 'rect' && (
                  <NumberField label="Radius" value={(el as ShapeElement).cornerRadius} onChange={(v, c) => set({ cornerRadius: v } as Partial<EditorElement>, c)} />
                )}
              </div>
            </>
          )}
        </Section>

        {el.type === 'text' && (
          <Section title="Type">
            <ColorField label="Color" value={(el as TextElement).fill} onChange={(v) => set({ fill: v } as Partial<EditorElement>)} />
            <div className="grid grid-cols-2 gap-1.5">
              <NumberField label="Size" value={(el as TextElement).fontSize} onChange={(v, c) => set({ fontSize: v } as Partial<EditorElement>, c)} />
              <NumberField label="Line" value={(el as TextElement).lineHeight * 10} onChange={(v, c) => set({ lineHeight: v / 10 } as Partial<EditorElement>, c)} />
            </div>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => {
                const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                return (
                  <button
                    key={a}
                    onClick={() => set({ align: a } as Partial<EditorElement>)}
                    aria-label={`Align ${a}`}
                    className={cn('flex-1 h-8 flex items-center justify-center rounded-md border transition-colors', (el as TextElement).align === a ? 'bg-[#4C9AFF]/20 border-[#4C9AFF] text-white' : 'border-[#2E2E2E] text-white/50 hover:text-white')}
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
              <div className="w-px bg-[#2E2E2E] mx-0.5" />
              <button
                onClick={() => set({ fontStyle: (el as TextElement).fontStyle.includes('bold') ? (el as TextElement).fontStyle.replace('bold', '').trim() || 'normal' : `${(el as TextElement).fontStyle === 'normal' ? '' : (el as TextElement).fontStyle + ' '}bold`.trim() } as Partial<EditorElement>)}
                aria-label="Bold"
                className={cn('w-8 h-8 flex items-center justify-center rounded-md border transition-colors', (el as TextElement).fontStyle.includes('bold') ? 'bg-[#4C9AFF]/20 border-[#4C9AFF] text-white' : 'border-[#2E2E2E] text-white/50 hover:text-white')}
              >
                <Bold size={14} />
              </button>
              <button
                onClick={() => set({ fontStyle: (el as TextElement).fontStyle.includes('italic') ? (el as TextElement).fontStyle.replace('italic', '').trim() || 'normal' : `${(el as TextElement).fontStyle === 'normal' ? '' : (el as TextElement).fontStyle + ' '}italic`.trim() } as Partial<EditorElement>)}
                aria-label="Italic"
                className={cn('w-8 h-8 flex items-center justify-center rounded-md border transition-colors', (el as TextElement).fontStyle.includes('italic') ? 'bg-[#4C9AFF]/20 border-[#4C9AFF] text-white' : 'border-[#2E2E2E] text-white/50 hover:text-white')}
              >
                <Italic size={14} />
              </button>
            </div>
          </Section>
        )}

        <Section title="Arrange">
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => moveZ(page.id, el.id, 'front')} className="h-8 flex items-center justify-center gap-1.5 rounded-md border border-[#2E2E2E] text-white/60 hover:text-white text-[11px] transition-colors">
              <BringToFront size={13} /> Front
            </button>
            <button onClick={() => moveZ(page.id, el.id, 'back')} className="h-8 flex items-center justify-center gap-1.5 rounded-md border border-[#2E2E2E] text-white/60 hover:text-white text-[11px] transition-colors">
              <SendToBack size={13} /> Back
            </button>
          </div>
        </Section>
      </div>
    )
  }

  // --- page selected ---
  const page = pages.find((p) => p.id === selectedPageId)
  if (page) {
    return (
      <div>
        <div className="px-3 py-2.5 border-b border-[#222] flex items-center gap-2">
          <Layers size={14} className="text-white/50" />
          <span className="text-xs font-semibold text-white capitalize">{page.type} page</span>
        </div>
        <Section title="Name">
          <input
            value={page.name}
            onChange={(e) => updatePage(page.id, { name: e.target.value }, false)}
            onBlur={(e) => updatePage(page.id, { name: e.target.value }, true)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full bg-[#1E1E1E] rounded-md border border-[#2E2E2E] focus:border-[#4C9AFF] outline-none px-2.5 py-1.5 text-xs text-white"
          />
        </Section>
        <Section title="Canvas size">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="W" value={page.width} onChange={(v, c) => updatePage(page.id, { width: v }, c)} />
            <NumberField label="H" value={page.height} onChange={(v, c) => updatePage(page.id, { height: v }, c)} />
          </div>
        </Section>
        <Section title="Background">
          <ColorField label="Fill" value={page.backgroundColor} onChange={(v) => updatePage(page.id, { backgroundColor: v }, false)} />
        </Section>
      </div>
    )
  }

  // --- nothing selected ---
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <SlidersHorizontal size={22} className="text-white/20 mb-3" />
      <p className="text-xs text-white/45">Select a page or element to see its properties.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
function AssistantTab() {
  const [input, setInput] = useState('')
  const actions = [
    { icon: MessageSquareText, label: 'Fix dialogue & grammar' },
    { icon: Wand2, label: 'Generate a background' },
    { icon: ScanText, label: 'Find continuity errors' },
    { icon: Palette, label: 'Suggest a color grade' },
  ]
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-3 space-y-3">
        <div className="rounded-xl bg-gradient-to-br from-[#4C9AFF]/10 to-[#A855F7]/10 border border-[#2A2A2A] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-[#4C9AFF]" />
            <span className="text-xs font-semibold text-white">Toonflow Assistant</span>
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Ask me to redraw a panel, rewrite a scene, translate dialogue, or check your pacing — I never block your flow.
          </p>
        </div>
        <div className="space-y-1.5">
          {actions.map((a) => (
            <button
              key={a.label}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#3A3A3A] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
            >
              <a.icon size={15} className="text-white/60 shrink-0" />
              <span className="text-xs text-white/80">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 border-t border-[#262626]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the assistant…"
            className="flex-1 h-11 resize-none rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none p-2.5 text-xs text-white placeholder:text-white/30"
          />
          <button
            aria-label="Send"
            className="w-11 h-11 shrink-0 rounded-lg bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white flex items-center justify-center hover:brightness-110 transition-all"
          >
            <Sparkles size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function ExportTab() {
  const activePageId = useEditorStore((s) => s.activePageId())
  const pages = useEditorStore((s) => s.pages)
  const [note, setNote] = useState<string | null>(null)
  const page = pages.find((p) => p.id === activePageId)

  const soon = ['Webtoon strip', 'Tapas', 'PDF', 'ZIP (all pages)', 'MP4 / GIF', 'PSD']

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-white/45 leading-relaxed">Export what you can render today; the rest of the pipeline is on the roadmap.</p>

      <button
        onClick={() => {
          if (!page) return
          const ok = exportPagePng(page.id, page.name)
          setNote(ok ? `Exported “${page.name}.png”` : 'Nothing to export yet')
        }}
        disabled={!page}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#4C9AFF] disabled:opacity-40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <ImageDown size={18} className="text-[#4C9AFF]" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-white">Active page → PNG (2×)</div>
          <div className="text-[10px] text-white/40">{page ? page.name : 'no page selected'}</div>
        </div>
      </button>

      <button
        onClick={() => {
          exportProjectJson()
          setNote('Downloaded project.json')
        }}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#4C9AFF] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <FileJson size={18} className="text-[#22C55E]" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-white">Whole project → JSON</div>
          <div className="text-[10px] text-white/40">reload-safe backup of every page</div>
        </div>
      </button>

      {note && <div className="text-[11px] text-[#22C55E] px-1" role="status">{note}</div>}

      <div className="pt-2">
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Coming soon</div>
        <div className="grid grid-cols-2 gap-1.5">
          {soon.map((s) => (
            <div key={s} className="px-2.5 py-2 rounded-lg bg-[#181818] border border-[#242424] text-[11px] text-white/40">{s}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
