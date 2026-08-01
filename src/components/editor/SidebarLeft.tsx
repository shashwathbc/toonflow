'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  FileStack,
  Layers,
  FolderOpen,
  Users,
  Sparkles,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Square,
  Circle,
  Image as ImageIcon,
  UploadCloud,
  Pencil,
  User,
  ImagePlus,
  MessageSquare,
  Loader2,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useEditorStore,
  PAGE_PRESETS,
  type LeftTab,
  type PageType,
  type EditorElement,
} from '@/store/useEditorStore'
import { processWebtoonImage } from '@/lib/utils/imageProcessing'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { ASSET_LIBRARY, svgToDataUri, type AssetItem } from '@/lib/editor/assetLibrary'
import { useCharacters } from '@/hooks/useCharacters'
import { deleteCharacter } from '@/lib/firebase/firestore'
import { CharacterDialog } from '@/components/editor/CharacterDialog'
import { useAgentWorkflow, type WorkflowState } from '@/components/editor/useAgentWorkflow'
import { pageGating, PAGE_STATUS_META } from '@/lib/editor/pageWorkflow'
import { cn } from '@/lib/utils/cn'
import type { Character } from '@/types'

const TABS: { id: LeftTab; icon: typeof Layers; label: string }[] = [
  { id: 'pages', icon: FileStack, label: 'Pages' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'assets', icon: FolderOpen, label: 'Assets' },
  { id: 'characters', icon: Users, label: 'Characters' },
  { id: 'ai', icon: Sparkles, label: 'AI Agents' },
]

const ELEMENT_ICON = { rect: Square, ellipse: Circle, text: Type, image: ImageIcon, paint: Pencil, bubble: MessageSquare } as const

const AGENTS = [
  { name: 'Story Director', desc: 'Plans the full episode beat sheet', color: '#4C9AFF' },
  { name: 'Script Writer', desc: 'Drafts dialogue & narration', color: '#A855F7' },
  { name: 'Storyboard Artist', desc: 'Lays out panels per scene', color: '#F59E0B' },
  { name: 'Character Designer', desc: 'Keeps characters consistent', color: '#EC4899' },
  { name: 'Environment Artist', desc: 'Generates backgrounds', color: '#22C55E' },
  { name: 'Color Artist', desc: 'Lighting, mood & grading', color: '#EF4444' },
  { name: 'QA Reviewer', desc: 'Continuity & cropping checks', color: '#14B8A6' },
  { name: 'Publisher', desc: 'Platform rule compliance', color: '#6366F1' },
]

export function SidebarLeft() {
  const leftTab = useEditorStore((s) => s.leftTab)
  const setLeftTab = useEditorStore((s) => s.setLeftTab)

  return (
    <aside className="h-full w-full flex bg-[#161616] border-r border-[#262626]">
      {/* vertical tab rail */}
      <div className="w-12 border-r border-[#262626] flex flex-col items-center py-2 gap-1 bg-[#121212] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLeftTab(tab.id)}
            aria-label={tab.label}
            aria-pressed={leftTab === tab.id}
            title={tab.label}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]',
              leftTab === tab.id ? 'bg-[#262626] text-white' : 'text-white/45 hover:text-white hover:bg-white/5',
            )}
          >
            <tab.icon size={18} />
          </button>
        ))}
      </div>

      {/* tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {leftTab === 'pages' && <PagesPanel />}
        {leftTab === 'layers' && <LayersPanel />}
        {leftTab === 'assets' && <AssetsPanel />}
        {leftTab === 'characters' && <CharactersPanel />}
        {leftTab === 'ai' && <AgentsPanel />}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="h-11 px-3 flex items-center justify-between border-b border-[#262626] shrink-0">
      <h2 className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
function PagesPanel() {
  const pages = useEditorStore((s) => s.pages)
  const order = useEditorStore((s) => s.timelineOrder)
  const selectedPageId = useEditorStore((s) => s.selectedPageId)
  const selectPage = useEditorStore((s) => s.selectPage)
  const fitPage = useEditorStore((s) => s.fitPage)
  const addPage = useEditorStore((s) => s.addPage)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const removePage = useEditorStore((s) => s.removePage)
  const [menu, setMenu] = useState(false)

  const ordered = order.map((id) => pages.find((p) => p.id === id)).filter(Boolean) as typeof pages
  // Page-by-page workflow gate: which agent-built pages are done / current / locked.
  const gating = useMemo(() => pageGating(pages, order), [pages, order])

  // Clicking a page "opens" it — select it and scroll the canvas to it.
  const openPage = (id: string) => {
    selectPage(id)
    fitPage(id)
  }

  return (
    <>
      <PanelHeader title="Pages">
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Add page"
            className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          >
            <Plus size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-8 z-40 w-56 bg-[#1E1E1E] border border-[#333] rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
                {(Object.keys(PAGE_PRESETS) as PageType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      addPage({}, t)
                      setMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="text-xs font-medium text-white">{PAGE_PRESETS[t].label}</div>
                    <div className="text-[10px] text-white/40 font-mono">{PAGE_PRESETS[t].hint}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </PanelHeader>

      {/* Chapter progress — only when the agent workflow has built pages. */}
      {gating.total > 0 && (
        <div className="px-3 pt-2.5 pb-2 border-b border-[#242424] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Chapter</span>
            <span className="text-[10px] font-mono text-white/45">{gating.completed}/{gating.total} approved</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#242424] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4C9AFF] to-[#22C55E] transition-all"
              style={{ width: `${gating.total ? (gating.completed / gating.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        {ordered.length === 0 && <p className="text-xs text-white/40 p-3">No pages yet. Press + to add one.</p>}
        {ordered.map((page, i) => {
          const gate = gating.info.get(page.id)
          const meta = gate ? PAGE_STATUS_META[gate.status] : null
          // The page's art bitmap (if any) so the swatch previews it — a CSS
          // background image displays regardless of Storage CORS.
          const artSrc = page.elements.find(
            (e): e is Extract<EditorElement, { type: 'image' }> => e.type === 'image' && !!e.src,
          )?.src
          return (
            <div
              key={page.id}
              onClick={() => { if (!gate?.locked) openPage(page.id) }}
              aria-disabled={gate?.locked || undefined}
              className={cn(
                'group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                gate?.locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                selectedPageId === page.id
                  ? 'bg-[#4C9AFF]/15 ring-1 ring-[#4C9AFF]/40'
                  : gate?.isCurrent
                    ? 'ring-1 ring-[#A855F7]/40 bg-[#A855F7]/5 hover:bg-[#A855F7]/10'
                    : !gate?.locked && 'hover:bg-white/5',
              )}
            >
              <span className="text-[10px] font-mono text-white/30 w-4 text-center">{i + 1}</span>
              <div className="relative shrink-0">
                <div
                  className="w-6 h-8 rounded-sm border border-[#333] bg-cover bg-center"
                  style={artSrc ? { backgroundImage: `url("${artSrc}")` } : { background: page.backgroundColor }}
                />
                {meta && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#161616]"
                    style={{ background: meta.dot }}
                    title={meta.label}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{page.name}</div>
                {meta ? (
                  <div className={cn('text-[10px] font-medium flex items-center gap-1', meta.text)}>
                    {gate?.locked && <Lock size={9} aria-hidden="true" />}
                    {gate?.locked ? 'Locked' : meta.label}
                  </div>
                ) : (
                  <div className="text-[10px] text-white/35 capitalize">{page.type}</div>
                )}
              </div>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); duplicatePage(page.id) }}
                  aria-label="Duplicate page"
                  className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removePage(page.id) }}
                  aria-label="Delete page"
                  className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-danger hover:bg-white/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
function LayersPanel() {
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId())
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const selectElements = useEditorStore((s) => s.selectElements)
  const updateElement = useEditorStore((s) => s.updateElement)
  const page = pages.find((p) => p.id === activePageId)

  return (
    <>
      <PanelHeader title={page ? `Layers · ${page.name}` : 'Layers'} />
      <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-[#333]">
        {!page || page.elements.length === 0 ? (
          <p className="text-xs text-white/40 p-3">This page has no layers yet.</p>
        ) : (
          [...page.elements].reverse().map((el: EditorElement) => {
            const Icon = ELEMENT_ICON[el.type]
            const sel = selectedElementIds.includes(el.id)
            return (
              <div
                key={el.id}
                onClick={(e) => selectElements([el.id], e.shiftKey)}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                  sel ? 'bg-[#4C9AFF]/15 ring-1 ring-[#4C9AFF]/40' : 'hover:bg-white/5',
                )}
              >
                <Icon size={14} className="text-white/50 shrink-0" />
                <span className={cn('flex-1 text-xs truncate', el.isHidden ? 'text-white/30' : 'text-white/85')}>
                  {el.type === 'text' ? el.text || 'Text' : el.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); updateElement(page.id, el.id, { isLocked: !el.isLocked }, true) }}
                  aria-label={el.isLocked ? 'Unlock layer' : 'Lock layer'}
                  className={cn('w-6 h-6 flex items-center justify-center rounded hover:bg-white/10', el.isLocked ? 'text-[#4C9AFF]' : 'text-white/40 opacity-0 group-hover:opacity-100')}
                >
                  {el.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); updateElement(page.id, el.id, { isHidden: !el.isHidden }, true) }}
                  aria-label={el.isHidden ? 'Show layer' : 'Hide layer'}
                  className={cn('w-6 h-6 flex items-center justify-center rounded hover:bg-white/10', el.isHidden ? 'text-white/60' : 'text-white/40 opacity-0 group-hover:opacity-100')}
                >
                  {el.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
function AssetsPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const addElement = useEditorStore((s) => s.addElement)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const s = useEditorStore.getState()
    const pageId = s.activePageId()
    if (!pageId) return
    const page = s.pages.find((p) => p.id === pageId)!
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const parts = await processWebtoonImage(file)
        // Upload to Storage first so the element's src is a URL, never base64
        // (keeps the persisted canvas project small).
        for (let i = 0; i < parts.length; i++) {
          const img = parts[i]
          const url = await uploadCanvasImage(img.src, img.originalName)
          const w = Math.min(page.width * 0.8, 500)
          const h = (img.height / img.width) * w
          addElement(pageId, { type: 'image', src: url, x: 40 + i * 20, y: 40 + i * 20, width: w, height: h, name: img.originalName })
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const addAsset = (item: AssetItem) => {
    const s = useEditorStore.getState()
    const pageId = s.activePageId()
    if (!pageId) return
    const page = s.pages.find((p) => p.id === pageId)
    if (!page) return
    s.addElement(pageId, item.create(page))
  }

  return (
    <>
      <PanelHeader title="Assets" />
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-[#333]">
        {/* Starter library — click to drop onto the active page */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-white/45 uppercase tracking-widest">Starter Kit</p>
          {ASSET_LIBRARY.map((cat) => (
            <div key={cat.id} className="space-y-1.5">
              <p className="text-[10px] text-white/35 font-medium">{cat.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addAsset(item)}
                    title={`Add ${item.label}`}
                    aria-label={`Add ${item.label}`}
                    className="group aspect-square rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#4C9AFF] hover:bg-[#4C9AFF]/5 flex items-center justify-center p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={svgToDataUri(item.thumb)} alt="" className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100" draggable={false} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Upload */}
        <div className="pt-1 border-t border-[#242424]">
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 w-full h-20 rounded-xl border-2 border-dashed border-[#333] hover:border-[#4C9AFF] hover:bg-[#4C9AFF]/5 flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          >
            {busy ? (
              <span className="text-xs text-white/60">Processing…</span>
            ) : (
              <>
                <UploadCloud size={20} className="text-white/50" />
                <span className="text-xs text-white/60 font-medium">Upload artwork</span>
                <span className="text-[10px] text-white/30">Added to the active page</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
          />
          <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
            Supports PNG · JPG · WEBP · AVIF today. PSD / CLIP / layered import lands in the pipeline next — files are
            auto-fit to Webtoon width and long strips are sliced.
          </p>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
function CharactersPanel() {
  const assetCtx = useEditorStore((s) => s.assetCtx)
  const webtoonId = assetCtx?.webtoonId
  const uid = assetCtx?.uid
  const { characters, loading } = useCharacters(webtoonId)
  // 'new' opens a blank dialog; a Character opens it prefilled for editing.
  const [dialog, setDialog] = useState<Character | 'new' | null>(null)

  const ready = !!webtoonId && !!uid

  const insertOnPage = (c: Character) => {
    const s = useEditorStore.getState()
    const pageId = s.activePageId()
    const page = pageId ? s.pages.find((p) => p.id === pageId) : null
    if (!page) {
      toast.error('Add or select a page first')
      return
    }
    if (c.imageUrl) {
      const w = Math.round(Math.min(page.width * 0.5, 520))
      const h = Math.round(w * 1.3)
      s.addElement(page.id, { type: 'image', src: c.imageUrl, x: Math.round((page.width - w) / 2), y: Math.round(page.height * 0.12), width: w, height: h, name: c.name })
    } else {
      s.addElement(page.id, { type: 'text', text: c.name, x: Math.round(page.width * 0.1), y: Math.round(page.height * 0.1), width: Math.round(page.width * 0.8), fontSize: Math.round(page.width * 0.07), fontStyle: 'bold', align: 'center', fill: '#111111', name: c.name })
    }
    toast.success(`${c.name} added to page`)
  }

  const remove = async (c: Character) => {
    if (!webtoonId) return
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return
    try {
      await deleteCharacter(webtoonId, c.id)
      toast.success('Character deleted')
    } catch {
      toast.error('Could not delete character')
    }
  }

  return (
    <>
      <PanelHeader title="Characters">
        <button
          onClick={() => setDialog('new')}
          disabled={!ready}
          aria-label="New character"
          className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#333]">
        {loading && ready && <p className="text-[11px] text-white/35 p-1">Loading roster…</p>}

        {ready && !loading && characters.length === 0 && (
          <button
            onClick={() => setDialog('new')}
            className="w-full rounded-xl border-2 border-dashed border-[#333] hover:border-[#4C9AFF] hover:bg-[#4C9AFF]/5 py-8 flex flex-col items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          >
            <Users size={22} className="text-white/40" aria-hidden="true" />
            <span className="text-xs text-white/60 font-medium">Add your first character</span>
            <span className="text-[10px] text-white/30">Reuse them on any page</span>
          </button>
        )}

        {characters.map((c) => (
          <div key={c.id} className="group flex items-center gap-3 p-2.5 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors">
            <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ background: c.imageUrl ? undefined : `linear-gradient(135deg, ${c.color}, #1a1a1a)` }}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={16} className="text-white/70" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{c.name}</div>
              <div className="text-[10px] text-white/40 truncate">{c.role || 'Character'}</div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => insertOnPage(c)} aria-label={`Use ${c.name} on page`} title="Add to page" className="w-7 h-7 flex items-center justify-center rounded-md text-white/55 hover:text-[#4C9AFF] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
                <ImagePlus size={14} aria-hidden="true" />
              </button>
              <button onClick={() => setDialog(c)} aria-label={`Edit ${c.name}`} title="Edit" className="w-7 h-7 flex items-center justify-center rounded-md text-white/55 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button onClick={() => remove(c)} aria-label={`Delete ${c.name}`} title="Delete" className="w-7 h-7 flex items-center justify-center rounded-md text-white/55 hover:text-danger hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        <p className="text-[11px] text-white/35 leading-relaxed pt-2">
          Build a cast once, then drop any character straight onto a page. Add a reference portrait to keep faces,
          outfits and palettes consistent.
        </p>
      </div>

      {dialog && ready && (
        <CharacterDialog
          uid={uid!}
          webtoonId={webtoonId!}
          character={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

// The page-wise pipeline, surfaced as a stepper so the AI Agents panel reads as
// Brief → Story Plan → Generate Pages. There is no separate "template" step:
// Generate Story Plan plans the chapter AND lays out every page, then the creator
// generates each page's art one at a time from the right sidebar.
const WORKFLOW_STAGES = ['Brief', 'Story Plan', 'Generate Pages'] as const

function stageIndex(s: WorkflowState): number {
  switch (s) {
    case 'idle':
    case 'error':
      return 0 // Step 1 · Chapter Brief
    case 'planning':
      return 1 // Step 2 · Planning + laying out pages
    case 'ready':
      return 2 // Step 3 · Generate each page
  }
}

function WorkflowStepper({ stage }: { stage: number }) {
  return (
    <div className="mb-3 flex items-center gap-1" aria-label={`Step ${stage + 1} of ${WORKFLOW_STAGES.length}: ${WORKFLOW_STAGES[stage]}`}>
      {WORKFLOW_STAGES.map((label, i) => {
        const active = i === stage
        const done = i < stage
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors',
                  done ? 'bg-[#22C55E] text-black' : active ? 'bg-[#A855F7] text-white' : 'bg-[#2A2A2A] text-white/40',
                )}
                aria-hidden="true"
              >
                {done ? <Check size={9} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-[10px] font-medium truncate', active ? 'text-white' : done ? 'text-white/55' : 'text-white/35')}>
                {label}
              </span>
            </div>
            {i < WORKFLOW_STAGES.length - 1 && (
              <div className={cn('flex-1 h-px transition-colors', done ? 'bg-[#22C55E]/50' : 'bg-[#2A2A2A]')} aria-hidden="true" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function AgentsPanel() {
  const [prompt, setPrompt] = useState('')
  const setLeftTab = useEditorStore((s) => s.setLeftTab)
  const {
    workflowState,
    progress,
    result,
    pageCount,
    character,
    generatePlan,
    reset,
  } = useAgentWorkflow()

  const running = workflowState === 'planning'

  return (
    <>
      <PanelHeader title="AI Agents" />
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#333]">
        {AGENTS.map((a) => (
          <div
            key={a.name}
            className={cn(
              'w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl bg-[#1E1E1E] border transition-colors',
              running ? 'border-[#3A3A3A]' : 'border-[#2A2A2A]',
            )}
          >
            <span
              className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', running && 'animate-pulse')}
              style={{ background: a.color }}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-white">{a.name}</span>
              <span className="block text-[10px] text-white/45">{a.desc}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#262626]">
        <WorkflowStepper stage={stageIndex(workflowState)} />

        {workflowState !== 'ready' ? (
          <>
            <label htmlFor="chapter-brief" className="block mb-1.5 text-[10px] font-semibold text-white/50 uppercase tracking-widest">
              Chapter Brief
            </label>
            <textarea
              id="chapter-brief"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              disabled={running}
              placeholder="Describe the chapter, or paste your script. e.g. “A lonely prince discovers an ancient dragon sleeping beneath his kingdom.” The team plans the story and lays out every page — its panel art prompt and dialogue — so you can generate each page's art one at a time."
              className="w-full h-24 resize-none rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none p-2.5 text-xs text-white placeholder:text-white/30 disabled:opacity-60"
            />
          </>
        ) : (
          <div className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-2.5 text-xs text-white/80">
            <p className="font-semibold text-white mb-1">Pages ready — generate one at a time</p>
            <p>The Story Director laid out <strong>{pageCount} pages</strong>, each with its art prompt and dialogue in place.</p>
            {character && <p className="mt-1 text-[10px] text-white/60"><strong>Cast:</strong> {character} · saved to your roster</p>}
            <p className="mt-2 text-[10px] text-[#4C9AFF]">
              Open a page, then press “Generate this page” in the right sidebar. Approve it to unlock the next.
            </p>
          </div>
        )}

        {progress && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#4C9AFF]" role="status" aria-live="polite">
            <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
            <span className="truncate">{progress}</span>
          </p>
        )}

        {!running && result && (
          <p className="mt-2 text-[11px] leading-snug text-white/60 border border-[#2A2A2A] rounded-md p-2" role="status">
            {result}
          </p>
        )}

        {/* Buttons for each state */}
        {workflowState !== 'ready' && (
          <button
            type="button"
            onClick={() => generatePlan(prompt)}
            disabled={running}
            className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF] flex items-center justify-center gap-1.5"
          >
            {running ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Planning &amp; laying out pages…
              </>
            ) : (
              'Generate Story Plan'
            )}
          </button>
        )}

        {workflowState === 'ready' && (
          <>
            <button
              type="button"
              onClick={() => setLeftTab('pages')}
              className="mt-2 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white text-xs font-semibold hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF] flex items-center justify-center gap-1.5"
            >
              <FileStack size={13} aria-hidden="true" />
              Open pages to generate
            </button>
            <button
              type="button"
              onClick={reset}
              className="mt-2 w-full py-2 rounded-lg bg-[#2A2A2A] text-white/80 text-xs font-semibold hover:bg-[#333] transition-all"
            >
              Start new chapter
            </button>
          </>
        )}
      </div>
    </>
  )
}
