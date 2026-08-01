'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
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
  Loader2,
  Lock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import {
  useEditorStore,
  type RightTab,
  type EditorElement,
  type TextElement,
  type ShapeElement,
  type Page,
} from '@/store/useEditorStore'
import { exportPagePng, exportProjectJson } from '@/lib/editor/exportProject'
import { regeneratePanelArt, pageHasArt, buildPagePromptBlock, applyPromptLinesToPage } from '@/lib/editor/panelArt'
import { parsePagePrompt } from '@/lib/editor/promptFormat'
import { pageGating, effectiveStatus, PAGE_STATUS_META } from '@/lib/editor/pageWorkflow'
import { cn } from '@/lib/utils/cn'

const TABS: { id: RightTab; icon: typeof SlidersHorizontal; label: string }[] = [
  { id: 'properties', icon: SlidersHorizontal, label: 'Properties' },
  { id: 'assistant', icon: Sparkles, label: 'Assistant' },
  { id: 'export', icon: Download, label: 'Export' },
]

const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
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
/**
 * Per-page AI art + gated page-by-page workflow. Shown for any agent-built
 * webtoon panel (a page that carries an `artPrompt`). Edit the prompt and
 * generate JUST this panel's background art (swapped in behind the bubbles, so
 * dialogue and manual edits stay on top), then Approve the page — which locks it
 * in and unlocks the next page in reading order.
 */
function PanelArtSection({ page }: { page: Page }) {
  // The parent keys this component by page id, so it remounts (and re-seeds the
  // prompt from that page's artPrompt) whenever the selection moves to a
  // different panel — no reset effect needed.
  const pageId = page.id
  // The editable field is the canonical PROMPT / TEXT block: the art-only prompt
  // plus this page's dialogue/SFX projected as [TAG] rows. Seeded once (the parent
  // keys this by page id, so it re-seeds when selection moves to another page).
  const [prompt, setPrompt] = useState(() => buildPagePromptBlock(page))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pages = useEditorStore((s) => s.pages)
  const order = useEditorStore((s) => s.timelineOrder)
  const setPageStatus = useEditorStore((s) => s.setPageStatus)
  const selectPage = useEditorStore((s) => s.selectPage)
  const fitPage = useEditorStore((s) => s.fitPage)

  const gate = useMemo(() => pageGating(pages, order).info.get(pageId), [pages, order, pageId])
  const status = gate?.status ?? effectiveStatus(page)
  const locked = gate?.locked ?? false
  const hasArt = pageHasArt(page)
  const meta = PAGE_STATUS_META[status]

  const run = async () => {
    // Split the block: the PROMPT paints the art; the TEXT rows rewrite the
    // on-canvas dialogue/SFX (never sent to the image model).
    const { art, lines } = parsePagePrompt(prompt)
    if (art.trim().length < 4) {
      setError('Describe the panel art under PROMPT first.')
      return
    }
    const wasCompleted = status === 'completed'
    setBusy(true)
    setError(null)
    setPageStatus(pageId, 'generating')
    const res = await regeneratePanelArt(pageId, art)
    // Apply the edited TEXT block to the bubbles regardless of art outcome — the
    // dialogue edit is independent of whether the image request succeeded.
    applyPromptLinesToPage(pageId, lines)
    setBusy(false)
    if (res.ok) {
      // Keep an already-approved page approved after a tweak; otherwise it now
      // has art and is waiting for the creator to approve it.
      setPageStatus(pageId, wasCompleted ? 'completed' : 'painted')
      toast.success('Panel art updated')
    } else {
      setPageStatus(pageId, wasCompleted ? 'completed' : 'ready')
      setError(res.error)
      toast.error(`Couldn't generate: ${res.error}`)
    }
  }

  const approve = () => {
    setPageStatus(pageId, 'completed')
    // Recompute after the status change; currentId is now the next unapproved page.
    const s = useEditorStore.getState()
    const next = pageGating(s.pages, s.timelineOrder).currentId
    if (next && next !== pageId) {
      selectPage(next)
      fitPage(next)
      toast.success('Page approved — next page unlocked')
    } else {
      toast.success('Chapter complete — every page approved 🎉')
    }
  }

  // A later page can't be worked until the earlier ones are approved.
  if (locked) {
    return (
      <Section title="AI art">
        <div className="flex items-center gap-2 rounded-md border border-[#2E2E2E] bg-[#1E1E1E] p-2.5">
          <Lock size={14} className="text-white/40 shrink-0" aria-hidden="true" />
          <p className="text-[11px] text-white/50 leading-snug">Approve the earlier pages first to unlock this one.</p>
        </div>
      </Section>
    )
  }

  return (
    <Section title="AI art">
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold', meta.text)}>
          <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} aria-hidden="true" />
          {meta.label}
        </span>
        {gate && <span className="text-[10px] font-mono text-white/35">Page {gate.index + 1}</span>}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        disabled={busy}
        rows={11}
        spellCheck={false}
        placeholder={'PROMPT\nEnvironment, any characters present, camera, cinematic style. Color: dominant …, secondary …, accent …\n\nTEXT\n[SFX] DONG. DONG.\n[NARRATION] A forgotten age had ended.'}
        className="w-full resize-none rounded-md bg-[#1E1E1E] border border-[#2E2E2E] focus:border-[#4C9AFF] outline-none p-2.5 text-[11px] leading-relaxed font-mono text-white placeholder:text-white/30 disabled:opacity-60"
      />
      <p className="text-[10px] text-white/40 leading-snug">
        <strong className="text-white/55">PROMPT</strong> paints the art (never printed on the page).{' '}
        <strong className="text-white/55">TEXT</strong> rows become emotion-matched speech bubbles — <code className="text-white/50">[SHOUT]</code>, <code className="text-white/50">[WHISPER]</code>, <code className="text-white/50">[NARRATION]</code>, <code className="text-white/50">[SFX]</code>.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-full py-2 rounded-md bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF] flex items-center justify-center gap-1.5"
      >
        {busy ? (
          <>
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Generating… (~1 min)
          </>
        ) : (
          <>
            <Wand2 size={13} aria-hidden="true" />
            {hasArt ? 'Regenerate this page' : 'Generate this page'}
          </>
        )}
      </button>

      {/* Approve → lock this page in and unlock the next. Only offered once the
          page has art and hasn't been approved yet. */}
      {hasArt && status !== 'completed' && (
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="w-full py-2 rounded-md bg-[#22C55E] text-black text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={13} aria-hidden="true" />
          Approve page
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      )}
      {status === 'completed' && (
        <p className="flex items-center gap-1.5 text-[10px] text-[#22C55E] leading-snug">
          <CheckCircle2 size={12} aria-hidden="true" />
          Approved — you can still edit or regenerate anytime.
        </p>
      )}

      {error && (
        <p className="text-[10px] text-danger leading-snug" role="alert">
          {error}
        </p>
      )}
      <p className="text-[10px] text-white/40 leading-snug">
        Edit the description, then generate. Your speech bubbles and edits stay on top.
      </p>
    </Section>
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70 flex-1">Blend</span>
            <select
              value={el.blendMode ?? 'source-over'}
              onChange={(e) => set({ blendMode: e.target.value as GlobalCompositeOperation })}
              className="w-28 bg-[#1E1E1E] rounded-md border border-[#2E2E2E] focus:border-[#4C9AFF] outline-none px-2 py-1 text-[11px] text-white cursor-pointer"
              aria-label="Blend mode"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
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

        {/* The panel this element sits on is an agent-built webtoon page — let the
            user re-paint its art from an edited prompt without leaving selection. */}
        {page.artPrompt && <PanelArtSection key={page.id} page={page} />}
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
        {page.artPrompt && <PanelArtSection key={page.id} page={page} />}
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
