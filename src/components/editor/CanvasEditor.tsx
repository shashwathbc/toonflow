'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Play,
  Save,
  Globe,
  ChevronUp,
  ChevronDown,
  Command,
  Plus,
  Check,
  Loader2,
  Download,
  Type,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SidebarLeft } from '@/components/editor/SidebarLeft'
import { SidebarRight } from '@/components/editor/SidebarRight'
import { TimelineBottom } from '@/components/editor/TimelineBottom'
import { SmartDropzone } from '@/components/editor/SmartDropzone'
import { TopToolbar } from '@/components/editor/TopToolbar'
import { CommandPalette } from '@/components/editor/CommandPalette'
import { ResizeHandle } from '@/components/editor/ResizeHandle'
import { BrandingMetaDialog } from '@/components/editor/BrandingMetaDialog'
import { useEditorShortcuts } from '@/components/editor/useEditorShortcuts'
import { useEditorStore } from '@/store/useEditorStore'
import { useAuth } from '@/hooks/useAuth'
import { useEpisodes } from '@/hooks/useEpisodes'
import { useTransientState } from '@/hooks/useTransientState'
import {
  getWebtoonById,
  createEpisode,
  updateEpisode,
  saveEpisodeCanvas,
  publishEpisode,
  publishWebtoon,
} from '@/lib/firebase/firestore'
import { uploadEpisodePanel } from '@/lib/firebase/storage'
import {
  serializeProject,
  migratePanelsToPages,
  projectHasContent,
} from '@/lib/editor/persistence'
import { exportPageBlob, exportMergedStripBlob, downloadBlob } from '@/lib/editor/exportProject'
import { cn } from '@/lib/utils/cn'
import type { Webtoon, Episode, PanelImage } from '@/types'

// Konva must be client-only and code-split so it never evaluates during SSR.
const WorkspaceDynamic = dynamic(
  () => import('@/components/editor/Workspace').then((m) => m.Workspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-[#0C0C0C] flex items-center justify-center text-white/30 text-sm">
        Loading canvas…
      </div>
    ),
  },
)

const PUBLISH_WIDTH = 1080

export function CanvasEditor({ webtoonId }: { webtoonId: string }) {
  const router = useRouter()
  const { firebaseUser, loading: authLoading } = useAuth()
  const { episodes, loading: episodesLoading } = useEpisodes(webtoonId)

  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [fetchedId, setFetchedId] = useState<string | null>(null)
  const webtoonLoading = fetchedId !== webtoonId

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false)
  const [brandingEdit, setBrandingEdit] = useState<'intro' | 'outro' | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [saveState, setSaveState] = useTransientState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // The user's explicit pick wins; otherwise fall back to the first episode.
  // Derived (not stored) so a freshly-created episode becomes active without a
  // setState-in-effect (which the React Compiler lint rejects).
  const activeEpisodeId = selectedEpisodeId ?? episodes[0]?.id ?? null
  const activeEpisode = episodes.find((e) => e.id === activeEpisodeId) ?? null

  // ---- store bindings ------------------------------------------------------
  const addPage = useEditorStore((s) => s.addPage)
  const selectPage = useEditorStore((s) => s.selectPage)
  const loadProject = useEditorStore((s) => s.loadProject)
  const setAssetCtx = useEditorStore((s) => s.setAssetCtx)
  const setExporting = useEditorStore((s) => s.setExporting)
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const rightOpen = useEditorStore((s) => s.rightOpen)
  const timelineOpen = useEditorStore((s) => s.timelineOpen)
  const leftWidth = useEditorStore((s) => s.leftWidth)
  const rightWidth = useEditorStore((s) => s.rightWidth)
  const setLeftWidth = useEditorStore((s) => s.setLeftWidth)
  const setRightWidth = useEditorStore((s) => s.setRightWidth)
  const setTimelineHeight = useEditorStore((s) => s.setTimelineHeight)
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const toggleRight = useEditorStore((s) => s.toggleRight)
  const toggleTimeline = useEditorStore((s) => s.toggleTimeline)

  useEditorShortcuts()

  // ---- autosave plumbing ---------------------------------------------------
  const hydratingRef = useRef(false)
  const hydratedEpisodeId = useRef<string | null>(null)
  const activeEpisodeIdRef = useRef<string | null>(null)
  const lastPagesRef = useRef<unknown>(null)
  const lastOrderRef = useRef<unknown>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creatingRef = useRef(false)
  const episodesRef = useRef<Episode[]>([])

  // Keep the refs the subscription/handlers read in sync — in effects, never
  // during render (React Compiler lint: no ref writes in render).
  useEffect(() => { episodesRef.current = episodes }, [episodes])
  useEffect(() => { activeEpisodeIdRef.current = activeEpisodeId }, [activeEpisodeId])

  const doSave = useCallback(
    async (epId: string) => {
      try {
        setSaveState('saving')
        const project = serializeProject()
        await saveEpisodeCanvas(webtoonId, epId, project)
        setSaveState('saved', 1800)
      } catch (err) {
        console.error('Canvas autosave failed', err)
        setSaveState('error')
      }
    },
    [webtoonId, setSaveState],
  )

  const scheduleSave = useCallback(
    (epId: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void doSave(epId)
      }, 1200)
    },
    [doSave],
  )

  const flushSave = useCallback(() => {
    const epId = activeEpisodeIdRef.current
    if (!epId) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void doSave(epId)
  }, [doSave])

  // ---- load the webtoon + ownership guard ----------------------------------
  useEffect(() => {
    getWebtoonById(webtoonId)
      .then((w) => {
        setWebtoon(w)
        if (w && firebaseUser && w.authorId !== firebaseUser.uid) {
          toast.error('You do not have permission to edit this webtoon.')
          router.push('/create/webtoon')
        }
      })
      .catch(() => toast.error('Failed to load webtoon'))
      .finally(() => setFetchedId(webtoonId))
  }, [webtoonId, firebaseUser, router])

  // ---- create the first episode if the webtoon has none --------------------
  // No setState here: once the new episode arrives from the subscription, the
  // derived `activeEpisodeId` picks it up as episodes[0].
  useEffect(() => {
    if (episodesLoading || episodes.length > 0 || creatingRef.current) return
    creatingRef.current = true
    createEpisode(webtoonId, { episodeNumber: 1, title: 'Episode 1' }).catch(() =>
      toast.error('Failed to create the first episode'),
    )
  }, [episodes, episodesLoading, webtoonId])

  // ---- hydrate the canvas when the active episode changes ------------------
  // Depends on `episodes` too so a freshly-created episode hydrates once it
  // arrives from the subscription; guarded by `hydratedEpisodeId` so ordinary
  // autosave-driven episode updates never re-hydrate mid-edit.
  useEffect(() => {
    if (!activeEpisodeId || !webtoon) return
    if (hydratedEpisodeId.current === activeEpisodeId) return
    const ep = episodes.find((e) => e.id === activeEpisodeId)
    if (!ep) return

    hydratedEpisodeId.current = activeEpisodeId
    hydratingRef.current = true

    if (projectHasContent(ep.canvasProject)) {
      loadProject(ep.canvasProject!)
    } else if (ep.panels && ep.panels.length > 0) {
      loadProject(migratePanelsToPages(ep.panels))
    } else {
      loadProject(null)
      const coverId = addPage({ name: 'Cover' }, 'cover')
      addPage({ name: 'Scene 1' }, 'webtoon')
      selectPage(coverId)
    }

    const st = useEditorStore.getState()
    lastPagesRef.current = st.pages
    lastOrderRef.current = st.timelineOrder

    requestAnimationFrame(() => {
      useEditorStore.getState().fitAll(false)
      hydratingRef.current = false
    })
  }, [activeEpisodeId, episodes, webtoon, addPage, selectPage, loadProject])

  // ---- autosave subscription (once) ----------------------------------------
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (hydratingRef.current) return
      const epId = activeEpisodeIdRef.current
      if (!epId) return
      if (state.pages === lastPagesRef.current && state.timelineOrder === lastOrderRef.current) return
      lastPagesRef.current = state.pages
      lastOrderRef.current = state.timelineOrder
      scheduleSave(epId)
    })
    return () => {
      unsub()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [scheduleSave])

  // ---- keep the image-upload target current --------------------------------
  useEffect(() => {
    if (firebaseUser && activeEpisodeId) {
      setAssetCtx({ uid: firebaseUser.uid, webtoonId, episodeId: activeEpisodeId })
    } else {
      setAssetCtx(null)
    }
  }, [firebaseUser, activeEpisodeId, webtoonId, setAssetCtx])

  // ---- reset the shared store when leaving the editor ----------------------
  useEffect(() => {
    return () => {
      setAssetCtx(null)
      setExporting(false)
      loadProject(null)
      hydratedEpisodeId.current = null
    }
  }, [setAssetCtx, setExporting, loadProject])

  // ---- episode switching ---------------------------------------------------
  const switchEpisode = (id: string) => {
    setEpisodeMenuOpen(false)
    if (id === activeEpisodeId) return
    flushSave() // persist the outgoing episode before we swap the canvas out
    setSelectedEpisodeId(id)
  }

  const createNewEpisode = async () => {
    setEpisodeMenuOpen(false)
    flushSave()
    const num = episodesRef.current.reduce((m, e) => Math.max(m, e.episodeNumber ?? 0), 0) + 1
    try {
      const id = await createEpisode(webtoonId, { episodeNumber: num, title: `Episode ${num}` })
      setSelectedEpisodeId(id)
    } catch {
      toast.error('Failed to create episode')
    }
  }

  // ---- publish: rasterize pages → panel images → existing pipeline ---------
  const handlePublish = async () => {
    const epId = activeEpisodeIdRef.current
    if (!epId || !webtoon || !firebaseUser) return
    if (!webtoon.coverURL) {
      toast.error('Add a cover image before publishing')
      return
    }
    if (!webtoon.synopsis?.trim()) {
      toast.error('Add a description before publishing')
      return
    }

    const st0 = useEditorStore.getState()
    const order = st0.timelineOrder.filter((id) => {
      const p = st0.pages.find((pg) => pg.id === id)
      return p && !p.isHidden
    })
    if (order.length === 0) {
      toast.error('Add at least one page before publishing')
      return
    }

    setPublishing(true)
    const restoreSafeZone = st0.showSafeZone
    const progress = toast.loading('Preparing pages…')
    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (restoreSafeZone) st0.toggleSafeZone()
      st0.clearSelection()
      st0.selectPage(null)
      setExporting(true)
      // Let off-screen pages mount and their bitmaps decode before rasterizing.
      await new Promise((r) => setTimeout(r, 700))

      const panels: PanelImage[] = []
      let thumbnailURL: string | null = null
      for (let i = 0; i < order.length; i++) {
        const pageId = order[i]
        const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
        if (!page) continue
        toast.loading(`Rendering page ${i + 1} of ${order.length}…`, { id: progress })
        const blob = await exportPageBlob(pageId, PUBLISH_WIDTH)
        if (!blob) continue
        const file = new File([blob], `panel_${i}.jpg`, { type: 'image/jpeg' })
        const url = await uploadEpisodePanel(firebaseUser.uid, webtoonId, epId, file, i)
        panels.push({
          url,
          width: PUBLISH_WIDTH,
          height: Math.round((PUBLISH_WIDTH * page.height) / page.width),
          order: i,
          altText: page.name,
        })
        if (i === 0) thumbnailURL = url
      }

      if (panels.length === 0) throw new Error('No pages rendered')

      toast.loading('Publishing…', { id: progress })
      const project = serializeProject()
      await updateEpisode(webtoonId, epId, { panels, canvasProject: project, thumbnailURL })
      await publishEpisode(webtoonId, epId)
      await publishWebtoon(webtoonId)
      setWebtoon((prev) => (prev ? { ...prev, status: 'ongoing' } : prev))
      toast.success('Published! Your episode is live.', { id: progress })
    } catch (err) {
      console.error('Publish failed', err)
      toast.error('Publish failed. Please try again.', { id: progress })
    } finally {
      setExporting(false)
      if (restoreSafeZone) useEditorStore.getState().toggleSafeZone()
      setPublishing(false)
    }
  }

  // ---- download one merged long-scroll PNG ---------------------------------
  const [exportingStrip, setExportingStrip] = useState(false)
  const handleDownloadMerged = async () => {
    const st = useEditorStore.getState()
    if (st.timelineOrder.length === 0) {
      toast.error('Nothing to export yet')
      return
    }
    setExportingStrip(true)
    const t = toast.loading('Merging pages…')
    try {
      st.clearSelection()
      st.selectPage(null)
      setExporting(true)
      await new Promise((r) => setTimeout(r, 600))
      const blob = await exportMergedStripBlob(st.timelineOrder, PUBLISH_WIDTH)
      if (blob) {
        downloadBlob(blob, `${(webtoon?.title || 'webtoon').replace(/[^\w-]+/g, '_')}-episode.png`)
        toast.success('Downloaded merged strip', { id: t })
      } else {
        toast.error('Nothing to export', { id: t })
      }
    } catch (err) {
      console.error(err)
      toast.error('Export failed', { id: t })
    } finally {
      setExporting(false)
      setExportingStrip(false)
    }
  }

  const handlePreview = () => {
    if (!activeEpisodeId) return
    window.open(`/webtoon/${webtoonId}/episode/${activeEpisodeId}`, '_blank', 'noopener')
  }

  const saveBrandingMeta = async (meta: Record<string, string>) => {
    if (!activeEpisode || !brandingEdit) return
    const patch: Partial<Episode> = brandingEdit === 'intro' ? { intro: meta } : { outro: meta }
    try {
      await updateEpisode(webtoonId, activeEpisode.id, patch)
      toast.success(brandingEdit === 'intro' ? 'Intro page updated' : 'Outro page updated')
    } catch (err) {
      toast.error('Failed to save page text')
      throw err
    }
  }

  // ---- render --------------------------------------------------------------
  const isLoading = authLoading || webtoonLoading
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black" role="status" aria-label="Loading editor">
        <Loader2 size={22} className="text-white/30 animate-spin" aria-hidden="true" />
      </div>
    )
  }
  if (!webtoon) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black gap-4">
        <p className="text-white/50 text-sm">Webtoon not found</p>
        <Link href="/create/webtoon" className="text-xs text-[#4C9AFF] hover:underline">
          ← Back to Webtoon Studio
        </Link>
      </div>
    )
  }

  const toggleBtn =
    'w-8 h-8 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]'

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Autosaved'

  return (
    <SmartDropzone>
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-black text-white select-none">
        {/* Top bar */}
        <header className="h-12 bg-[#141414] border-b border-[#262626] flex items-center px-3 justify-between shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/create/webtoon"
              aria-label="Back to Webtoon Studio"
              className={cn(toggleBtn, 'text-white/60 hover:text-white hover:bg-white/10')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
            <div className="h-4 w-px bg-[#2E2E2E]" />

            {/* Episode switcher */}
            <div className="relative">
              <button
                onClick={() => setEpisodeMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={episodeMenuOpen}
                className="flex flex-col items-start leading-tight px-2 py-1 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF] max-w-[220px]"
              >
                <span className="text-[13px] font-semibold text-white truncate max-w-[200px]">{webtoon.title}</span>
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  {activeEpisode ? activeEpisode.title || `Episode ${activeEpisode.episodeNumber}` : 'Loading…'}
                  <ChevronDown size={10} aria-hidden="true" />
                </span>
              </button>
              {episodeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setEpisodeMenuOpen(false)} />
                  <div className="absolute left-0 top-11 z-40 w-64 bg-[#1E1E1E] border border-[#333] rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333]">
                      {episodes.map((ep) => (
                        <button
                          key={ep.id}
                          role="menuitem"
                          onClick={() => switchEpisode(ep.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                            ep.id === activeEpisodeId ? 'bg-[#4C9AFF]/15 text-white' : 'hover:bg-white/5 text-white/80',
                          )}
                        >
                          <span className="text-[10px] font-mono text-white/30 w-5 text-center">{ep.episodeNumber}</span>
                          <span className="flex-1 min-w-0 truncate text-xs font-medium">
                            {ep.title || `Episode ${ep.episodeNumber}`}
                          </span>
                          {ep.status === 'published' && <span className="text-[9px] text-[#22C55E] font-semibold uppercase">Live</span>}
                          {ep.id === activeEpisodeId && <Check size={13} className="text-[#4C9AFF]" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    <div className="my-1 h-px bg-[#2A2A2A]" />
                    <button
                      role="menuitem"
                      onClick={createNewEpisode}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-white/80 hover:bg-white/5 transition-colors"
                    >
                      <Plus size={14} aria-hidden="true" /> New Episode
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setEpisodeMenuOpen(false); setBrandingEdit('intro') }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <Type size={14} aria-hidden="true" /> Edit Intro Text
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setEpisodeMenuOpen(false); setBrandingEdit('outro') }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <Layers size={14} aria-hidden="true" /> Edit Outro Text
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Panel toggles */}
          <div className="flex items-center gap-1">
            <button onClick={toggleLeft} aria-label="Toggle left panel" aria-pressed={leftOpen} className={cn(toggleBtn, leftOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelLeft size={16} aria-hidden="true" />
            </button>
            <button onClick={toggleTimeline} aria-label="Toggle timeline" aria-pressed={timelineOpen} className={cn(toggleBtn, timelineOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelBottom size={16} aria-hidden="true" />
            </button>
            <button onClick={toggleRight} aria-label="Toggle right panel" aria-pressed={rightOpen} className={cn(toggleBtn, rightOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelRight size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <span className="hidden md:flex items-center gap-1 text-[10px] text-white/35" aria-live="polite">
              {saveState === 'saving' && <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
              {saveLabel}
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/35 border border-[#2A2A2A] rounded-md px-1.5 py-1">
              <Command size={11} aria-hidden="true" /> K
            </span>
            <button onClick={flushSave} className="h-8 px-2.5 flex items-center gap-1.5 text-xs text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
              <Save size={14} aria-hidden="true" /> Save
            </button>
            <button onClick={handleDownloadMerged} disabled={exportingStrip} aria-label="Download merged strip" title="Download merged long-scroll PNG" className="h-8 w-8 flex items-center justify-center text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
              {exportingStrip ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
            </button>
            <button onClick={handlePreview} className="h-8 px-2.5 flex items-center gap-1.5 text-xs text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
              <Play size={14} aria-hidden="true" /> Preview
            </button>
            <button onClick={handlePublish} disabled={publishing} className="h-8 px-3 flex items-center gap-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
              {publishing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Globe size={14} aria-hidden="true" />}
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {leftOpen && (
            <>
              <div style={{ width: leftWidth }} className="h-full shrink-0">
                <SidebarLeft />
              </div>
              <ResizeHandle orientation="vertical" onDelta={(d) => setLeftWidth(leftWidth + d)} />
            </>
          )}

          <div className="relative flex-1 flex flex-col overflow-hidden">
            <TopToolbar />
            <WorkspaceDynamic />
          </div>

          {rightOpen && (
            <>
              <ResizeHandle orientation="vertical" invert onDelta={(d) => setRightWidth(rightWidth - d)} />
              <div style={{ width: rightWidth }} className="h-full shrink-0">
                <SidebarRight />
              </div>
            </>
          )}
        </div>

        {/* Timeline */}
        {timelineOpen ? (
          <>
            <ResizeHandle orientation="horizontal" invert onDelta={(d) => setTimelineHeight(useEditorStore.getState().timelineHeight + d)} />
            <TimelineBottom />
          </>
        ) : (
          <button
            onClick={toggleTimeline}
            className="h-7 bg-[#141414] border-t border-[#262626] flex items-center gap-2 px-3 text-white/45 hover:text-white transition-colors shrink-0"
          >
            <ChevronUp size={13} aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Story Timeline</span>
          </button>
        )}

        <CommandPalette />

        {brandingEdit && activeEpisode && (
          <BrandingMetaDialog
            kind={brandingEdit}
            webtoon={webtoon}
            episode={activeEpisode}
            onClose={() => setBrandingEdit(null)}
            onSave={saveBrandingMeta}
          />
        )}
      </div>
    </SmartDropzone>
  )
}
