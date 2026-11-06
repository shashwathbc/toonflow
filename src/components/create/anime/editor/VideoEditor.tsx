'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Check,
  Cloud,
  Download,
  Loader2,
  Pause,
  Play,
  Redo2,
  Settings2,
  SkipBack,
  Sliders,
  Undo2,
  X,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useVideoEditorStore } from '@/store/useVideoEditorStore'
import EditorPreview from './EditorPreview'
import EditorTimeline, { formatTimecode } from './EditorTimeline'
import EditorSidebar, { SIDEBAR_TABS, type SidebarTab } from './EditorSidebar'
import EditorProperties from './EditorProperties'
import {
  emptyTimeline,
  loadTimeline,
  saveRevision,
  saveTimeline,
  subscribeToScenes,
} from '@/lib/firebase/anime'
import { timelineSchema } from '@/lib/anime/schema'
import { track as trackEvent } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import type { AnimeProject, AnimeScene } from '@/types/anime'

/** Debounce window for autosave. Long enough that a drag saves once. */
const AUTOSAVE_MS = 2000
/** Playback tick — 30fps is smooth without pinning a mobile CPU. */
const TICK_MS = 1000 / 30

export default function VideoEditor({ project }: { project: AnimeProject }) {
  const isMobile = useIsMobile()
  const [scenes, setScenes] = useState<AnimeScene[]>([])
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<SidebarTab>('media')
  const [mobilePanel, setMobilePanel] = useState<'none' | 'tools' | 'properties'>('none')

  const load = useVideoEditorStore((s) => s.load)
  const tracks = useVideoEditorStore((s) => s.tracks)
  const dirty = useVideoEditorStore((s) => s.dirty)
  const saving = useVideoEditorStore((s) => s.saving)
  const lastSavedAt = useVideoEditorStore((s) => s.lastSavedAt)
  const playing = useVideoEditorStore((s) => s.playing)
  const playhead = useVideoEditorStore((s) => s.playhead)
  const fps = useVideoEditorStore((s) => s.fps)
  const aspectRatio = useVideoEditorStore((s) => s.aspectRatio)
  const setPlaying = useVideoEditorStore((s) => s.setPlaying)
  const setPlayhead = useVideoEditorStore((s) => s.setPlayhead)
  const undo = useVideoEditorStore((s) => s.undo)
  const redo = useVideoEditorStore((s) => s.redo)
  const splitClipAtPlayhead = useVideoEditorStore((s) => s.splitClipAtPlayhead)
  const duplicateClip = useVideoEditorStore((s) => s.duplicateClip)
  const removeClip = useVideoEditorStore((s) => s.removeClip)
  const markSaved = useVideoEditorStore((s) => s.markSaved)
  const setSaving = useVideoEditorStore((s) => s.setSaving)

  // ── Load ────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    void loadTimeline(project.id).then((timeline) => {
      if (!active) return
      load(project.id, timeline, {
        ...emptyTimeline(project.defaults.aspectRatio, project.defaults.fps),
        updatedAt: null,
      })
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [project.id, project.defaults.aspectRatio, project.defaults.fps, load])

  useEffect(() => subscribeToScenes(project.id, setScenes), [project.id])

  // ── Autosave ────────────────────────────────────────────
  // Debounced so a drag gesture produces one write, and validated with the SAME
  // schema the server uses — a timeline that wouldn't survive validation should
  // fail here, loudly, not silently persist a shape nothing else can read.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const persist = useCallback(async () => {
    const state = useVideoEditorStore.getState()
    const candidate = {
      version: 1 as const,
      aspectRatio: state.aspectRatio,
      fps: state.fps,
      tracks: state.tracks,
    }
    const parsed = timelineSchema.safeParse(candidate)
    if (!parsed.success) {
      console.error('[VideoEditor] timeline failed validation', parsed.error.issues[0])
      toast.error('Some edits could not be saved. Please undo the last change.')
      setSaving(false)
      return
    }
    setSaving(true)
    try {
      await saveTimeline(project.id, candidate)
      markSaved()
    } catch (err) {
      console.error('[VideoEditor] save failed', err)
      setSaving(false)
      toast.error('Could not save. Your changes are still here — check your connection.')
    }
  }, [project.id, markSaved, setSaving])

  useEffect(() => {
    if (!ready || !dirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void persist(), AUTOSAVE_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [tracks, aspectRatio, dirty, ready, persist])

  // Last line of defence against losing work on an accidental close.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (useVideoEditorStore.getState().dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Playback ────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    let accumulated = 0

    const step = (nowMs: number) => {
      const delta = nowMs - last
      last = nowMs
      accumulated += delta

      // Throttle the STORE writes to ~30/s. rAF can fire at 120Hz on a
      // high-refresh display, and a Zustand set() per frame re-renders the whole
      // editor — the playhead does not need that resolution.
      if (accumulated >= TICK_MS) {
        const state = useVideoEditorStore.getState()
        const next = state.playhead + accumulated / 1000
        accumulated = 0
        const end = state.duration()
        if (next >= end) {
          state.setPlayhead(end)
          state.setPlaying(false)
          return
        }
        state.setPlayhead(next)
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Never hijack typing.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (target?.isContentEditable) return

      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persist()
        return
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        const selected = useVideoEditorStore.getState().selectedClipId
        if (selected) duplicateClip(selected)
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying(!useVideoEditorStore.getState().playing)
        return
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        splitClipAtPlayhead()
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setPlayhead(0)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selected = useVideoEditorStore.getState().selectedClipId
        if (selected) {
          event.preventDefault()
          removeClip(selected)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, persist, duplicateClip, splitClipAtPlayhead, setPlaying, setPlayhead, removeClip])

  const handleSnapshot = async () => {
    const state = useVideoEditorStore.getState()
    try {
      await saveRevision(project.id, `Manual save · ${new Date().toLocaleString()}`, {
        version: 1,
        aspectRatio: state.aspectRatio,
        fps: state.fps,
        tracks: state.tracks,
      })
      await persist()
      toast.success('Version saved')
    } catch {
      toast.error('Could not save a version')
    }
  }

  const handleExport = () => {
    trackEvent('video_exported', {
      projectId: project.id,
      trackCount: tracks.length,
      surface: 'editor',
    })
    // ═══ INTEGRATION BOUNDARY ═══
    // Rendering a composed timeline into one video file needs server-side
    // encoding (ffmpeg or the provider's compositor). Saying so is the honest
    // answer; producing a silently wrong file, or a "success" toast with no
    // file, would not be. Individual generated clips CAN be downloaded today
    // from the project workspace, which is offered here as the real alternative.
    toast(
      'Timeline export needs the video render service, which isn’t connected yet. You can download individual generated clips from the project page.',
      { duration: 8000, icon: 'ℹ️' },
    )
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 size={26} className="animate-spin text-text-muted motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Loading editor…</span>
      </div>
    )
  }

  const saveLabel = saving
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : lastSavedAt
        ? 'All changes saved'
        : 'Not saved yet'

  const transport = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setPlayhead(0)}
        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Jump to start"
      >
        <SkipBack size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="rounded-lg bg-accent p-2 text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
      <span className="ml-1.5 font-mono text-[11px] tabular-nums text-text-secondary">
        {formatTimecode(playhead, fps)}
      </span>
    </div>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-bg-border bg-bg-card px-2 sm:px-3">
        <Link
          href={`/create/anime/project/${project.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Back to project"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden text-sm sm:inline">Project</span>
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-text">{project.title}</h1>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={undo}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={redo}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Autosave indicator — text + icon, never colour alone. */}
        <p
          className="hidden items-center gap-1.5 text-[11px] text-text-muted md:flex"
          role="status"
          aria-live="polite"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : dirty ? (
            <Cloud size={12} aria-hidden="true" />
          ) : (
            <Check size={12} aria-hidden="true" />
          )}
          {saveLabel}
        </p>

        <button
          type="button"
          onClick={() => void handleSnapshot()}
          className="hidden shrink-0 rounded-lg border border-bg-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:block"
        >
          Save version
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-studio-anime px-3 py-1.5 text-xs font-bold text-bg transition-colors hover:bg-studio-anime/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
        >
          <Download size={14} aria-hidden="true" />
          Export
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      {isMobile ? (
        // MOBILE: the preview is the hero, the timeline stays usable underneath,
        // and both sidebars collapse into bottom sheets. Deliberately NOT a
        // shrunken desktop editor — three columns at 375px is unusable.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <EditorPreview projectId={project.id} scenes={scenes} />
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-bg-border bg-bg-card px-2 py-1.5">
            {transport}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={undo}
                className="rounded-lg p-2 text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Undo"
              >
                <Undo2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={redo}
                className="rounded-lg p-2 text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Redo"
              >
                <Redo2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="h-56 shrink-0">
            <EditorTimeline />
          </div>

          {/* Bottom action bar */}
          <div
            className="flex shrink-0 items-center justify-around border-t border-bg-border bg-bg-card py-1.5"
            style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={() => setMobilePanel('tools')}
              className="flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Settings2 size={18} aria-hidden="true" />
              Tools
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('properties')}
              className="flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Sliders size={18} aria-hidden="true" />
              Properties
            </button>
          </div>

          {/* Bottom sheet */}
          {mobilePanel !== 'none' && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
              <button
                type="button"
                className="flex-1 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobilePanel('none')}
                aria-label="Close panel"
              />
              <div className="max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-bg-border bg-bg-card animate-slide-up">
                <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
                  <h2 className="text-sm font-bold text-text">
                    {mobilePanel === 'tools' ? 'Tools' : 'Properties'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMobilePanel('none')}
                    className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label="Close"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="max-h-[calc(70vh-3.25rem)] overflow-y-auto">
                  {mobilePanel === 'tools' ? (
                    <div>
                      {/* Touch-friendly tab strip instead of the desktop icon rail. */}
                      <div
                        className="flex gap-1 overflow-x-auto border-b border-bg-border p-2"
                        role="tablist"
                        aria-label="Editor tools"
                      >
                        {SIDEBAR_TABS.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            onClick={() => setTab(id)}
                            className={cn(
                              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                              tab === id
                                ? 'bg-studio-anime/12 text-studio-anime'
                                : 'text-text-secondary hover:text-text',
                            )}
                          >
                            <Icon size={14} aria-hidden="true" />
                            {label}
                          </button>
                        ))}
                      </div>
                      {/* The desktop panel body is reused verbatim; only the
                          chrome around it changes on small screens. */}
                      <div className="[&>div>nav]:hidden [&>div>div]:w-full">
                        <EditorSidebar
                          projectId={project.id}
                          scenes={scenes}
                          activeTab={tab}
                          onTabChange={setTab}
                        />
                      </div>
                    </div>
                  ) : (
                    <EditorProperties />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // DESKTOP: classic three-column NLE.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <EditorSidebar projectId={project.id} scenes={scenes} activeTab={tab} onTabChange={setTab} />

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">
                <EditorPreview projectId={project.id} scenes={scenes} />
              </div>
              <div className="flex shrink-0 items-center justify-center border-t border-bg-border bg-bg-card py-1.5">
                {transport}
              </div>
            </div>

            <aside
              className="hidden w-72 shrink-0 border-l border-bg-border bg-bg-card xl:block"
              aria-label="Clip properties"
            >
              <EditorProperties />
            </aside>
          </div>

          <div className="h-64 shrink-0 2xl:h-72">
            <EditorTimeline />
          </div>
        </div>
      )}
    </div>
  )
}
