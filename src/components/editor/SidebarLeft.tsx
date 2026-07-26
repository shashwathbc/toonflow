'use client'

import React, { useRef, useState } from 'react'
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
} from 'lucide-react'
import {
  useEditorStore,
  PAGE_PRESETS,
  type LeftTab,
  type PageType,
  type EditorElement,
} from '@/store/useEditorStore'
import { processWebtoonImage } from '@/lib/utils/imageProcessing'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { cn } from '@/lib/utils/cn'

const TABS: { id: LeftTab; icon: typeof Layers; label: string }[] = [
  { id: 'pages', icon: FileStack, label: 'Pages' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'assets', icon: FolderOpen, label: 'Assets' },
  { id: 'characters', icon: Users, label: 'Characters' },
  { id: 'ai', icon: Sparkles, label: 'AI Agents' },
]

const ELEMENT_ICON = { rect: Square, ellipse: Circle, text: Type, image: ImageIcon } as const

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
  const addPage = useEditorStore((s) => s.addPage)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const removePage = useEditorStore((s) => s.removePage)
  const [menu, setMenu] = useState(false)

  const ordered = order.map((id) => pages.find((p) => p.id === id)).filter(Boolean) as typeof pages

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

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        {ordered.length === 0 && <p className="text-xs text-white/40 p-3">No pages yet. Press + to add one.</p>}
        {ordered.map((page, i) => (
          <div
            key={page.id}
            onClick={() => selectPage(page.id)}
            className={cn(
              'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
              selectedPageId === page.id ? 'bg-[#4C9AFF]/15 ring-1 ring-[#4C9AFF]/40' : 'hover:bg-white/5',
            )}
          >
            <span className="text-[10px] font-mono text-white/30 w-4 text-center">{i + 1}</span>
            <div
              className="w-6 h-8 rounded-sm border border-[#333] shrink-0"
              style={{ background: page.backgroundColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{page.name}</div>
              <div className="text-[10px] text-white/35 capitalize">{page.type}</div>
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
        ))}
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

  return (
    <>
      <PanelHeader title="Assets" />
      <div className="p-3">
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 rounded-xl border-2 border-dashed border-[#333] hover:border-[#4C9AFF] hover:bg-[#4C9AFF]/5 flex flex-col items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
        >
          {busy ? (
            <span className="text-xs text-white/60">Processing…</span>
          ) : (
            <>
              <UploadCloud size={22} className="text-white/50" />
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
        <p className="mt-4 text-[11px] text-white/40 leading-relaxed">
          Supports PNG · JPG · WEBP · AVIF today. PSD / CLIP / layered import lands in the pipeline next — files are
          auto-fit to Webtoon width and long strips are sliced.
        </p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
function CharactersPanel() {
  const chars = [
    { name: 'Ravana', role: 'Protagonist', score: 98, color: '#A855F7' },
    { name: 'Kishore', role: 'Mentor', score: 94, color: '#4C9AFF' },
  ]
  return (
    <>
      <PanelHeader title="Characters">
        <button aria-label="New character" className="w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10">
          <Plus size={16} />
        </button>
      </PanelHeader>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#333]">
        {chars.map((c) => (
          <div key={c.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors">
            <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${c.color}, #1a1a1a)` }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">{c.name}</div>
              <div className="text-[10px] text-white/40">{c.role}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/40">consistency</div>
              <div className="text-xs font-semibold text-[#22C55E]">{c.score}%</div>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-white/35 leading-relaxed pt-2">
          Character memory keeps faces, outfits and palettes consistent across every AI-generated panel.
        </p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
function AgentsPanel() {
  const [prompt, setPrompt] = useState('')
  return (
    <>
      <PanelHeader title="AI Agents" />
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#333]">
        {AGENTS.map((a) => (
          <button
            key={a.name}
            className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          >
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: a.color }} />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-white">{a.name}</span>
              <span className="block text-[10px] text-white/45">{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="p-3 border-t border-[#262626]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Brief the team — e.g. 'storyboard a 6-panel rooftop confrontation at dusk'…"
          className="w-full h-20 resize-none rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none p-2.5 text-xs text-white placeholder:text-white/30"
        />
        <button className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white text-xs font-semibold hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
          Run agent workflow
        </button>
      </div>
    </>
  )
}
