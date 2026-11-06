'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Music,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Video,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useVideoEditorStore } from '@/store/useVideoEditorStore'
import { cn } from '@/lib/utils/cn'
import type { TimelineClip, TimelineTrack, TrackKind } from '@/types/anime'

const TRACK_ICON: Record<TrackKind, typeof Video> = {
  video: Video,
  audio: Music,
  text: Type,
  effect: Sparkles,
}

/** Track-kind tint. Colour is decorative — the icon and label carry the meaning. */
const CLIP_TONE: Record<TrackKind, string> = {
  video: 'bg-studio-anime/25 border-studio-anime/50 text-text',
  audio: 'bg-success/20 border-success/45 text-text',
  text: 'bg-warning/20 border-warning/45 text-text',
  effect: 'bg-danger/15 border-danger/40 text-text',
}

const HEADER_WIDTH = 148
const TRACK_HEIGHT = 56
const RULER_HEIGHT = 28

/** Choose a tick interval that keeps labels ~70px apart at the current zoom. */
function tickInterval(pixelsPerSecond: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120]
  return candidates.find((step) => step * pixelsPerSecond >= 70) ?? 300
}

function formatTimecode(seconds: number, fps: number): string {
  const whole = Math.floor(seconds)
  const frames = Math.floor((seconds - whole) * fps)
  const mm = String(Math.floor(whole / 60)).padStart(2, '0')
  const ss = String(whole % 60).padStart(2, '0')
  return `${mm}:${ss}:${String(frames).padStart(2, '0')}`
}

interface DragState {
  clipId: string
  kind: 'move' | 'trim-start' | 'trim-end'
  originX: number
  originStart: number
  originDuration: number
  trackId: string
}

export default function EditorTimeline() {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const playhead = useVideoEditorStore((s) => s.playhead)
  const pixelsPerSecond = useVideoEditorStore((s) => s.pixelsPerSecond)
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId)
  const fps = useVideoEditorStore((s) => s.fps)
  const select = useVideoEditorStore((s) => s.select)
  const setPlayhead = useVideoEditorStore((s) => s.setPlayhead)
  const setZoom = useVideoEditorStore((s) => s.setZoom)
  const moveClip = useVideoEditorStore((s) => s.moveClip)
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const toggleTrack = useVideoEditorStore((s) => s.toggleTrack)
  const addTrack = useVideoEditorStore((s) => s.addTrack)
  const removeTrack = useVideoEditorStore((s) => s.removeTrack)
  const removeClip = useVideoEditorStore((s) => s.removeClip)
  const splitClipAtPlayhead = useVideoEditorStore((s) => s.splitClipAtPlayhead)
  const pushHistory = useVideoEditorStore((s) => s.pushHistory)
  const duration = useVideoEditorStore((s) => s.duration)

  const laneRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const totalDuration = duration()
  // Always leave a screen of empty runway past the last clip so there's
  // somewhere to drop the next one.
  const timelineWidth = Math.max((totalDuration + 10) * pixelsPerSecond, 800)

  const interval = tickInterval(pixelsPerSecond)
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let t = 0; t <= totalDuration + 10; t += interval) out.push(t)
    return out
  }, [totalDuration, interval])

  const secondsFromEvent = useCallback(
    (clientX: number): number => {
      const lane = laneRef.current
      if (!lane) return 0
      const rect = lane.getBoundingClientRect()
      return Math.max(0, (clientX - rect.left + lane.scrollLeft) / pixelsPerSecond)
    },
    [pixelsPerSecond],
  )

  // ── Pointer drag: move + trim ─────────────────────────
  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const state = drag.current
      if (!state) return
      const deltaSec = (event.clientX - state.originX) / pixelsPerSecond

      if (state.kind === 'move') {
        // Update in place while dragging; the single pushHistory() happened on
        // pointerdown, so the whole gesture is ONE undo step.
        updateClip(state.clipId, { start: Math.max(0, state.originStart + deltaSec) })
        return
      }
      if (state.kind === 'trim-end') {
        updateClip(state.clipId, { duration: Math.max(0.2, state.originDuration + deltaSec) })
        return
      }
      const clamped = Math.max(-state.originStart, Math.min(deltaSec, state.originDuration - 0.2))
      updateClip(state.clipId, {
        start: Math.max(0, state.originStart + clamped),
        duration: state.originDuration - clamped,
      })
    }

    const onUp = () => {
      const state = drag.current
      if (state?.kind === 'move') {
        // Commit through moveClip so the final position gets snapped to
        // neighbouring clip edges.
        const store = useVideoEditorStore.getState()
        const found = store.findClip(state.clipId)
        if (found) moveClip(state.clipId, state.trackId, found.clip.start)
      }
      drag.current = null
      setDragging(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, pixelsPerSecond, updateClip, moveClip])

  const beginDrag = (
    event: React.PointerEvent,
    clip: TimelineClip,
    track: TimelineTrack,
    kind: DragState['kind'],
  ) => {
    if (track.locked || clip.locked) return
    event.stopPropagation()
    event.preventDefault()
    pushHistory()
    select(clip.id)
    drag.current = {
      clipId: clip.id,
      kind,
      originX: event.clientX,
      originStart: clip.start,
      originDuration: clip.duration,
      trackId: track.id,
    }
    setDragging(clip.id)
  }

  /** Keyboard nudging — the accessible equivalent of dragging a clip. */
  const onClipKeyDown = (event: React.KeyboardEvent, clip: TimelineClip, track: TimelineTrack) => {
    const step = event.shiftKey ? 1 : 1 / fps
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (track.locked || clip.locked) return
      pushHistory()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      updateClip(clip.id, { start: Math.max(0, clip.start + direction * step) })
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeClip(clip.id)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select(clip.id)
    }
  }

  return (
    <section className="flex h-full flex-col border-t border-bg-border bg-bg-card" aria-label="Timeline">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-bg-border px-3 py-2">
        <span className="font-mono text-xs tabular-nums text-text" aria-live="off">
          {formatTimecode(playhead, fps)}
        </span>
        <span className="text-xs text-text-muted">/ {formatTimecode(totalDuration, fps)}</span>

        <div className="ml-3 flex items-center gap-1">
          <button
            type="button"
            onClick={splitClipAtPlayhead}
            disabled={!selectedClipId}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Split selected clip at playhead"
            title="Split (S)"
          >
            <Scissors size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => selectedClipId && removeClip(selectedClipId)}
            disabled={!selectedClipId}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            aria-label="Delete selected clip"
            title="Delete (Del)"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(pixelsPerSecond / 1.4)}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(pixelsPerSecond * 1.4)}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Lanes */}
      <div className="flex min-h-0 flex-1">
        {/* Track headers — sticky, so labels stay visible while scrolling time */}
        <div
          className="shrink-0 overflow-hidden border-r border-bg-border"
          style={{ width: HEADER_WIDTH }}
        >
          <div style={{ height: RULER_HEIGHT }} className="border-b border-bg-border" />
          <div className="overflow-y-auto">
            {tracks.map((track) => {
              const Icon = TRACK_ICON[track.kind]
              return (
                <div
                  key={track.id}
                  className="flex items-center gap-1.5 border-b border-bg-border px-2"
                  style={{ height: TRACK_HEIGHT }}
                >
                  <Icon size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-secondary">
                    {track.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTrack(track.id, track.kind === 'audio' ? 'muted' : 'hidden')}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={
                      track.kind === 'audio'
                        ? `${track.muted ? 'Unmute' : 'Mute'} ${track.name}`
                        : `${track.hidden ? 'Show' : 'Hide'} ${track.name}`
                    }
                    aria-pressed={track.kind === 'audio' ? track.muted : track.hidden}
                  >
                    {track.kind === 'audio' ? (
                      track.muted ? (
                        <VolumeX size={12} aria-hidden="true" />
                      ) : (
                        <Volume2 size={12} aria-hidden="true" />
                      )
                    ) : track.hidden ? (
                      <EyeOff size={12} aria-hidden="true" />
                    ) : (
                      <Eye size={12} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrack(track.id, 'locked')}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`${track.locked ? 'Unlock' : 'Lock'} ${track.name}`}
                    aria-pressed={track.locked}
                  >
                    {track.locked ? <Lock size={12} aria-hidden="true" /> : <LockOpen size={12} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrack(track.id)}
                    className="rounded p-1 text-text-muted transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                    aria-label={`Delete track ${track.name}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-1 p-2">
              {(['video', 'audio', 'text', 'effect'] as TrackKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addTrack(kind)}
                  className="inline-flex items-center gap-1 rounded-md border border-bg-border px-1.5 py-1 text-[10px] font-medium capitalize text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Plus size={9} aria-hidden="true" />
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable time area */}
        <div ref={laneRef} className="relative min-w-0 flex-1 overflow-auto">
          <div style={{ width: timelineWidth }}>
            {/* Ruler */}
            <div
              className="sticky top-0 z-10 cursor-pointer border-b border-bg-border bg-bg-card"
              style={{ height: RULER_HEIGHT }}
              onPointerDown={(event) => setPlayhead(secondsFromEvent(event.clientX))}
              role="slider"
              tabIndex={0}
              aria-label="Playhead position"
              aria-valuemin={0}
              aria-valuemax={Math.max(1, Math.round(totalDuration))}
              aria-valuenow={Math.round(playhead * 10) / 10}
              aria-valuetext={formatTimecode(playhead, fps)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  setPlayhead(Math.max(0, playhead - (event.shiftKey ? 1 : 1 / fps)))
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  setPlayhead(playhead + (event.shiftKey ? 1 : 1 / fps))
                }
                if (event.key === 'Home') {
                  event.preventDefault()
                  setPlayhead(0)
                }
                if (event.key === 'End') {
                  event.preventDefault()
                  setPlayhead(totalDuration)
                }
              }}
            >
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 h-full border-l border-bg-border pl-1 text-[9px] tabular-nums text-text-muted"
                  style={{ left: tick * pixelsPerSecond }}
                  aria-hidden="true"
                >
                  {tick % 1 === 0 ? `${tick}s` : `${tick.toFixed(1)}s`}
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => (
              <div
                key={track.id}
                className={cn(
                  'relative border-b border-bg-border',
                  track.locked && 'bg-bg-elevated/40',
                  track.hidden && 'opacity-50',
                )}
                style={{ height: TRACK_HEIGHT }}
                onPointerDown={(event) => {
                  // Clicking empty track space moves the playhead and clears
                  // selection — the standard NLE behaviour.
                  if (event.target === event.currentTarget) {
                    setPlayhead(secondsFromEvent(event.clientX))
                    select(null)
                  }
                }}
              >
                {track.clips.map((clip) => {
                  const isSelected = clip.id === selectedClipId
                  const label =
                    clip.kind === 'text'
                      ? (clip.text ?? 'Text')
                      : clip.kind === 'effect'
                        ? (clip.effect ?? 'Effect')
                        : clip.kind === 'audio'
                          ? 'Audio'
                          : 'Clip'
                  return (
                    <div
                      key={clip.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${label}, starts at ${clip.start.toFixed(1)} seconds, ${clip.duration.toFixed(1)} seconds long${isSelected ? ', selected' : ''}`}
                      aria-pressed={isSelected}
                      onKeyDown={(event) => onClipKeyDown(event, clip, track)}
                      onPointerDown={(event) => beginDrag(event, clip, track, 'move')}
                      onClick={() => select(clip.id)}
                      className={cn(
                        'absolute top-1.5 flex h-[calc(100%-12px)] select-none items-center overflow-hidden rounded-md border px-2 text-[11px] font-medium',
                        CLIP_TONE[track.kind],
                        isSelected && 'ring-2 ring-accent',
                        track.locked || clip.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      )}
                      style={{
                        left: clip.start * pixelsPerSecond,
                        width: Math.max(14, clip.duration * pixelsPerSecond),
                      }}
                    >
                      <span className="truncate">{label}</span>

                      {/* Trim handles */}
                      {!track.locked && !clip.locked && (
                        <>
                          <span
                            onPointerDown={(event) => beginDrag(event, clip, track, 'trim-start')}
                            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-accent/30 hover:bg-accent/60"
                            aria-hidden="true"
                          />
                          <span
                            onPointerDown={(event) => beginDrag(event, clip, track, 'trim-end')}
                            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-accent/30 hover:bg-accent/60"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 z-20 w-px bg-danger"
              style={{ left: playhead * pixelsPerSecond, height: RULER_HEIGHT + tracks.length * TRACK_HEIGHT }}
            >
              <span className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-danger" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { formatTimecode }
