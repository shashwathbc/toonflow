'use client'

import { useState, useEffect, useRef } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useEpisodes } from '@/hooks/useEpisodes'
import {
  getWebtoonById,
  updateEpisode,
  publishWebtoon,
  unpublishWebtoon,
} from '@/lib/firebase/firestore'
import { EpisodeSidebar } from '@/components/editor/EpisodeSidebar'
import { WebtoonToolbar } from '@/components/editor/WebtoonToolbar'
import dynamic from 'next/dynamic'

const AIImageGenerator = dynamic(
  () => import('@/components/novel/AIImageGenerator').then((m) => ({ default: m.AIImageGenerator })),
  { ssr: false, loading: () => <div className="w-72 bg-bg-card border-l border-bg-border shrink-0" aria-hidden="true" /> }
)
import {
  ImageIcon,
  Loader2,
  Upload,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Webtoon, Episode, PanelSpan } from '@/types'
import { uploadEpisodePanel } from '@/lib/firebase/storage'

interface PageProps {
  params: Promise<{ webtoonId: string }>
}

export default function WebtoonEditorPage({ params }: PageProps) {
  const { webtoonId } = use(params)
  const { firebaseUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const { episodes, loading: episodesLoading } = useEpisodes(webtoonId)

  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  // loading derives from "has the current webtoonId been fetched" so the effect
  // never calls setState synchronously (react-hooks/set-state-in-effect)
  const [fetchedId, setFetchedId] = useState<string | null>(null)
  const webtoonLoading = fetchedId !== webtoonId
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null)
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [, setPublishing] = useState(false)
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({})
  const [canvasWidth, setCanvasWidth] = useState(800)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const canvasStripRef = useRef<HTMLDivElement>(null)

  const CANVAS_MIN = 360
  const CANVAS_MAX = 1400

  // Width is set via the DOM: static-analysis a11y linters reject
  // dynamic inline style attributes in JSX
  useEffect(() => {
    if (canvasStripRef.current) canvasStripRef.current.style.width = `${canvasWidth}px`
  }, [canvasWidth])

  const clampCanvas = (w: number) => Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, w))

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = { startX: e.clientX, startWidth: canvasWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return
    // Strip is centered, so dragging one edge grows both sides
    const delta = (e.clientX - resizeRef.current.startX) * 2
    setCanvasWidth(clampCanvas(resizeRef.current.startWidth + delta))
  }
  const onResizeEnd = () => {
    resizeRef.current = null
  }

  // Load webtoon properties
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

  // Select first episode when list loads initially
  useEffect(() => {
    if (episodes.length > 0 && !activeEpisode) {
      selectEpisode(episodes[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes])

  function selectEpisode(episode: Episode) {
    setActiveEpisode(episode)
    setEpisodeTitle(episode.title ?? '')
  }

  async function handleTitleBlur() {
    if (!activeEpisode || !webtoon) return
    if (episodeTitle === activeEpisode.title) return

    setSaveState('saving')
    try {
      await updateEpisode(webtoonId, activeEpisode.id, { title: episodeTitle })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 1200 })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ width: 800, height: 1200 })
      }
      img.src = url
    })

  const handlePanelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeEpisode || !webtoon || !e.target.files) return
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setSaveState('saving')
    const currentPanels = activeEpisode.panels ?? []
    const updatedPanels = [...currentPanels]

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const order = currentPanels.length + i
        const tempKey = `${file.name}-${order}`

        setUploadingProgress((prev) => ({ ...prev, [tempKey]: 1 }))

        const url = await uploadEpisodePanel(
          webtoonId,
          activeEpisode.id,
          file,
          order,
          ({ progress }) => {
            setUploadingProgress((prev) => ({ ...prev, [tempKey]: progress }))
          }
        )

        const { width, height } = await readImageDimensions(file)
        updatedPanels.push({
          url,
          width,
          height,
          order,
          altText: file.name,
        })

        setUploadingProgress((prev) => {
          const next = { ...prev }
          delete next[tempKey]
          return next
        })
      }

      await updateEpisode(webtoonId, activeEpisode.id, { panels: updatedPanels })
      // Update local state panels reference
      setActiveEpisode((prev) => prev ? { ...prev, panels: updatedPanels } : prev)
      setSaveState('saved')
      toast.success('Panels uploaded successfully')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      console.error(err)
      setSaveState('error')
      toast.error('Failed to upload some panels')
    }
  }

  const removePanel = async (indexToRemove: number) => {
    if (!activeEpisode || !webtoon) return
    setSaveState('saving')

    const filteredPanels = (activeEpisode.panels ?? [])
      .filter((_, idx) => idx !== indexToRemove)
      .map((panel, idx) => ({ ...panel, order: idx }))

    try {
      await updateEpisode(webtoonId, activeEpisode.id, { panels: filteredPanels })
      setActiveEpisode((prev) => prev ? { ...prev, panels: filteredPanels } : prev)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const movePanel = async (index: number, direction: 'up' | 'down') => {
    if (!activeEpisode || !webtoon) return
    const panels = [...(activeEpisode.panels ?? [])]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= panels.length) return

    setSaveState('saving')
    // Swap panels
    const temp = panels[index]
    panels[index] = panels[targetIndex]
    panels[targetIndex] = temp

    // Re-index orders
    const ordered = panels.map((panel, idx) => ({ ...panel, order: idx }))

    try {
      await updateEpisode(webtoonId, activeEpisode.id, { panels: ordered })
      setActiveEpisode((prev) => prev ? { ...prev, panels: ordered } : prev)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const setPanelSpan = async (index: number, span: PanelSpan) => {
    if (!activeEpisode || !webtoon) return
    setSaveState('saving')
    const panels = (activeEpisode.panels ?? []).map((panel, idx) =>
      idx === index ? { ...panel, span } : panel
    )
    try {
      await updateEpisode(webtoonId, activeEpisode.id, { panels })
      setActiveEpisode((prev) => (prev ? { ...prev, panels } : prev))
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const makeThumbnail = async (url: string) => {
    if (!activeEpisode || !webtoon) return
    setSaveState('saving')
    try {
      await updateEpisode(webtoonId, activeEpisode.id, { thumbnailURL: url })
      setActiveEpisode((prev) => prev ? { ...prev, thumbnailURL: url } : prev)
      setSaveState('saved')
      toast.success('Thumbnail updated')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  async function handlePublish() {
    if (!webtoon) return
    if (!webtoon.coverURL) { toast.error('Add a cover image before publishing'); return }
    if (!webtoon.synopsis?.trim()) { toast.error('Add a description before publishing'); return }
    if (episodes.length === 0) { toast.error('Add at least one episode before publishing'); return }

    setPublishing(true)
    try {
      await publishWebtoon(webtoonId)
      setWebtoon((prev) => prev ? { ...prev, status: 'ongoing' } : prev)
      toast.success('Webtoon published! Now visible on Browse.')
    } catch {
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  async function handleUnpublish() {
    setPublishing(true)
    try {
      await unpublishWebtoon(webtoonId)
      setWebtoon((prev) => prev ? { ...prev, status: 'draft' } : prev)
      toast.success('Webtoon unpublished')
    } catch {
      toast.error('Failed to unpublish')
    } finally {
      setPublishing(false)
    }
  }

  const handleAIAccept = async (file: File) => {
    if (!activeEpisode || !webtoon) return
    setSaveState('saving')
    const currentPanels = activeEpisode.panels ?? []
    const updatedPanels = [...currentPanels]
    const order = currentPanels.length

    try {
      const url = await uploadEpisodePanel(
        webtoonId,
        activeEpisode.id,
        file,
        order
      )
      const { width, height } = await readImageDimensions(file)
      updatedPanels.push({
        url,
        width,
        height,
        order,
        altText: `AI generated panel ${order}`,
      })
      await updateEpisode(webtoonId, activeEpisode.id, { panels: updatedPanels })
      setActiveEpisode((prev) => prev ? { ...prev, panels: updatedPanels } : prev)
      setSaveState('saved')
      toast.success('AI panel uploaded successfully!')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const isLoading = authLoading || webtoonLoading || episodesLoading

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg" role="status" aria-label="Loading editor">
        <Loader2 size={24} className="text-white/30 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!webtoon) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg flex-col gap-4">
        <ImageIcon size={32} className="text-white/20" aria-hidden="true" />
        <p className="text-white/50">Webtoon not found</p>
        <button type="button" onClick={() => router.push('/create/webtoon')} className="btn-accent text-sm">
          Back to Webtoon Studio
        </button>
      </div>
    )
  }

  const isUploading = Object.keys(uploadingProgress).length > 0

  return (
    <div className={`flex flex-col bg-bg ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      {/* Top toolbar */}
      <WebtoonToolbar
        webtoon={webtoon}
        episode={activeEpisode}
        saveState={saveState}
        onSave={() => toast.success('Episode autosaved')}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        isFullscreen={fullscreen}
      />

      {/* Editor Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Episode sidebar */}
        {!fullscreen && (
          <EpisodeSidebar
            webtoonId={webtoonId}
            episodes={episodes}
            activeEpisodeId={activeEpisode?.id ?? null}
            onSelectEpisode={selectEpisode}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        )}

        {/* Center: Canvas Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-card border-r border-bg-border">
          {activeEpisode ? (
            <>
              {/* Episode metadata input */}
              <div className="px-8 py-4 border-b border-bg-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <input
                  type="text"
                  value={episodeTitle}
                  onChange={(e) => setEpisodeTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  placeholder="Episode Title"
                  className="bg-transparent text-lg font-bold text-white placeholder:text-white/20 outline-none focus-visible:ring-0 w-full max-w-md"
                  aria-label="Episode title"
                />

                {/* Upload Panels controls */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {/* Canvas width presets */}
                  <div
                    className="flex items-center gap-1 border border-bg-border rounded-lg px-1.5 py-1"
                    role="group"
                    aria-label="Canvas width"
                  >
                    {([
                      ['Mobile', 480],
                      ['Default', 800],
                      ['Wide', 1080],
                    ] as const).map(([label, width]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setCanvasWidth(width)}
                        className={`text-[11px] px-2 py-1 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                          canvasWidth === width
                            ? 'bg-accent/15 text-accent font-semibold'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="text-[10px] font-mono text-white/30 px-1.5 tabular-nums" aria-live="polite">
                      {canvasWidth}px
                    </span>
                  </div>

                  <label className="btn-accent text-xs px-3.5 py-2 cursor-pointer flex items-center gap-1.5 hover:bg-accent-hover transition-colors">
                    <Upload size={13} aria-hidden="true" />
                    Upload Panels
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePanelUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setAiCollapsed((v) => !v)}
                    className={`btn-ghost border border-bg-border text-xs px-3.5 py-2 flex items-center gap-1.5 transition-colors ${
                      !aiCollapsed ? 'text-accent border-accent/40 bg-accent/5' : ''
                    }`}
                  >
                    <Sparkles size={13} className="text-accent" aria-hidden="true" />
                    AI Panels
                  </button>
                </div>
              </div>

              {/* Panels vertical strip list */}
              <div className="flex-1 overflow-y-scroll overflow-x-auto bg-bg-elevated/40 p-6 flex flex-col items-center gap-4">
                {isUploading && (
                  <div className="w-full max-w-xl bg-bg-card border border-bg-border p-4 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-white/70">Uploading new panels…</p>
                    {Object.entries(uploadingProgress).map(([filename, progress]) => (
                      <div key={filename} className="flex items-center justify-between gap-4 text-[11px] text-white/50">
                        <span className="truncate flex-1">{filename}</span>
                        <span className="font-mono flex-shrink-0">{Math.round(progress)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {(activeEpisode.panels ?? []).length === 0 && !isUploading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 max-w-sm">
                    <Upload size={36} className="text-white/20 mb-3" aria-hidden="true" />
                    <h3 className="font-semibold text-white/80 text-sm mb-1">Canvas is empty</h3>
                    <p className="text-xs text-white/40 mb-4 leading-relaxed">
                      Upload vertical panel image strips or generate them with our Stability AI integration.
                    </p>
                  </div>
                ) : (
                  <div ref={canvasStripRef} className="relative flex-shrink-0">
                    <div className="bg-black shadow-2xl rounded-sm overflow-hidden flex flex-wrap items-start">
                    {(activeEpisode.panels ?? []).map((panel, idx) => {
                      const isThumb = activeEpisode.thumbnailURL === panel.url
                      const span = panel.span ?? 'full'
                      const spanClass =
                        span === 'half' ? 'w-1/2'
                        : span === 'third' ? 'w-1/3'
                        : span === 'two-thirds' ? 'w-2/3'
                        : 'w-full'
                      return (
                        <div
                          key={`${panel.url}-${idx}`}
                          className={`group relative ${spanClass}`}
                        >
                          {/* Seamless panel at natural aspect ratio, sized by its span template */}
                          <Image
                            src={panel.url}
                            alt={panel.altText ?? `Panel ${idx + 1}`}
                            width={panel.width || 800}
                            height={panel.height || 1200}
                            className="block w-full h-auto select-none"
                            sizes="(max-width: 800px) 100vw, 800px"
                          />

                          {/* Hover/focus overlay controls — hidden so the strip reads as one page */}
                          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 bg-gradient-to-b from-black/60 to-transparent pb-8 pointer-events-none">
                            <span className="text-[10px] bg-black/70 backdrop-blur-sm text-white/70 font-semibold px-2 py-0.5 rounded-full mt-0.5">
                              Panel {idx + 1}
                            </span>

                            <div className="flex items-center gap-1.5 pointer-events-auto bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() => movePanel(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-20 focus-visible:ring-2 focus-visible:ring-accent"
                                aria-label="Move panel up"
                              >
                                <ArrowUp size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => movePanel(idx, 'down')}
                                disabled={idx === (activeEpisode.panels ?? []).length - 1}
                                className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-20 focus-visible:ring-2 focus-visible:ring-accent"
                                aria-label="Move panel down"
                              >
                                <ArrowDown size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => makeThumbnail(panel.url)}
                                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 font-medium focus-visible:ring-2 focus-visible:ring-accent ${
                                  isThumb
                                    ? 'bg-accent/15 border-accent text-accent'
                                    : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                                }`}
                                aria-label="Set as episode thumbnail"
                              >
                                {isThumb && <Check size={11} aria-hidden="true" />}
                                Thumbnail
                              </button>
                              <button
                                type="button"
                                onClick={() => removePanel(idx)}
                                className="p-1 rounded-full hover:bg-danger/10 text-white/60 hover:text-danger focus-visible:ring-2 focus-visible:ring-accent"
                                aria-label="Remove panel"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          {/* Layout template picker — how much of the canvas this panel spans */}
                          <div className="absolute inset-x-0 bottom-0 flex justify-center p-2 pt-8 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                            <div
                              role="group"
                              aria-label={`Panel ${idx + 1} width template`}
                              className="flex items-center gap-0.5 pointer-events-auto bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-1"
                            >
                              {([
                                ['full', '1/1', 'Full width'],
                                ['two-thirds', '2/3', 'Two thirds width'],
                                ['half', '1/2', 'Half width'],
                                ['third', '1/3', 'One third width'],
                              ] as const).map(([value, label, name]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setPanelSpan(idx, value)}
                                  aria-label={name}
                                  {...(span === value ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                                    span === value
                                      ? 'bg-accent/20 text-accent font-bold'
                                      : 'text-white/50 hover:text-white hover:bg-white/10'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* End-of-strip append zone */}
                    <label className="w-full flex flex-col items-center justify-center gap-2 py-10 border-t border-dashed border-white/10 cursor-pointer text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
                      <Plus size={18} aria-hidden="true" />
                      <span className="text-xs font-medium">Add panels to the strip</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePanelUpload}
                      />
                    </label>
                    </div>

                    {/* Canvas resize handle — pointer drag surface; keyboard/AT
                        control goes through the native range input (implicit
                        ARIA, so no aria-value* expressions in JSX) */}
                    <div
                      aria-hidden="true"
                      onPointerDown={onResizeStart}
                      onPointerMove={onResizeMove}
                      onPointerUp={onResizeEnd}
                      onPointerCancel={onResizeEnd}
                      className="absolute top-0 -right-3 h-full w-3 cursor-col-resize flex items-center justify-center group/handle touch-none rounded"
                    >
                      <div className="w-1 h-16 rounded-full bg-white/15 group-hover/handle:bg-accent/60 transition-colors" />
                    </div>
                    <label htmlFor="canvas-width-range" className="sr-only">Canvas width in pixels</label>
                    <input
                      id="canvas-width-range"
                      type="range"
                      min={CANVAS_MIN}
                      max={CANVAS_MAX}
                      step={40}
                      value={canvasWidth}
                      onChange={(e) => setCanvasWidth(clampCanvas(Number(e.target.value)))}
                      className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-2 focus-visible:right-2 focus-visible:ring-2 focus-visible:ring-accent"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8" role="status">
              <ImageIcon size={40} className="text-white/10 mb-4" aria-hidden="true" />
              <h2 className="text-base font-medium text-white/40 mb-2">No episode selected</h2>
              <p className="text-sm text-white/25 max-w-xs">
                {episodes.length === 0
                  ? 'Click "Add Episode" in the sidebar to start creating.'
                  : 'Select an episode from the sidebar to begin editing.'}
              </p>
            </div>
          )}
        </div>

        {/* Right: AI Panel Generator */}
        {!fullscreen && !aiCollapsed && (
          <aside className="w-80 bg-bg p-4 flex flex-col gap-4 overflow-y-auto flex-shrink-0" aria-label="AI Panel Generator">
            <div className="flex items-center justify-between pb-2 border-b border-bg-border">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">AI Panel Generator</span>
              </div>
              <button
                type="button"
                onClick={() => setAiCollapsed(true)}
                className="text-xs text-white/40 hover:text-white"
              >
                Hide
              </button>
            </div>

            <p className="text-[11px] text-white/40 leading-normal">
              Describe the panel scene you want to generate. It will be appended to your episode strip.
            </p>

            <AIImageGenerator
              novelTitle={webtoon.title}
              novelSynopsis={webtoon.synopsis}
              imageType="cover"
              onAccept={handleAIAccept}
              onClose={() => setAiCollapsed(true)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
