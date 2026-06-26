'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useEpisodes } from '@/hooks/useEpisodes'
import {
  getWebtoonById,
  updateWebtoon,
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
import type { Webtoon, Episode, PanelImage } from '@/types'
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
  const [webtoonLoading, setWebtoonLoading] = useState(true)
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null)
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({})

  // Load webtoon properties
  useEffect(() => {
    setWebtoonLoading(true)
    getWebtoonById(webtoonId)
      .then((w) => {
        setWebtoon(w)
        if (w && firebaseUser && w.authorId !== firebaseUser.uid) {
          toast.error('You do not have permission to edit this webtoon.')
          router.push('/create/webtoon')
        }
      })
      .catch(() => toast.error('Failed to load webtoon'))
      .finally(() => setWebtoonLoading(false))
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

        // Default dimensions, or standard 800px width/height ratio
        updatedPanels.push({
          url,
          width: 800,
          height: 1200,
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
      updatedPanels.push({
        url,
        width: 800,
        height: 1200,
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
                <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="flex-1 overflow-y-auto bg-bg-elevated/40 p-6 flex flex-col items-center gap-4">
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
                  <div className="w-full max-w-xl space-y-3">
                    {(activeEpisode.panels ?? []).map((panel, idx) => {
                      const isThumb = activeEpisode.thumbnailURL === panel.url
                      return (
                        <div
                          key={`${panel.url}-${idx}`}
                          className="group relative bg-bg-card border border-bg-border rounded-xl overflow-hidden shadow-md"
                        >
                          <div className="relative w-full aspect-[4/3] bg-black">
                            <Image
                              src={panel.url}
                              alt={panel.altText ?? `Panel ${idx + 1}`}
                              fill
                              className="object-contain"
                              sizes="(max-width: 600px) 100vw, 600px"
                            />

                            {/* Top badge */}
                            <span className="absolute top-2 left-2 text-[10px] bg-black/60 backdrop-blur-sm text-white/60 font-semibold px-2 py-0.5 rounded-full">
                              Panel {idx + 1}
                            </span>
                          </div>

                          {/* Controls bar */}
                          <div className="px-3 py-2 bg-bg-card/95 border-t border-bg-border flex items-center justify-between gap-4 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => movePanel(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20"
                                aria-label="Move panel up"
                              >
                                <ArrowUp size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => movePanel(idx, 'down')}
                                disabled={idx === (activeEpisode.panels ?? []).length - 1}
                                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20"
                                aria-label="Move panel down"
                              >
                                <ArrowDown size={13} aria-hidden="true" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => makeThumbnail(panel.url)}
                                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 font-medium ${
                                  isThumb
                                    ? 'bg-accent/15 border-accent text-accent'
                                    : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                                }`}
                                aria-label="Set as episode thumbnail"
                              >
                                {isThumb && <Check size={11} aria-hidden="true" />}
                                Thumbnail
                              </button>
                              <button
                                type="button"
                                onClick={() => removePanel(idx)}
                                className="p-1 rounded hover:bg-danger/10 text-white/40 hover:text-danger"
                                aria-label="Remove panel"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
