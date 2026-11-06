// Timeline state for the AI video editor.
//
// Follows the same shape as useEditorStore (the webtoon canvas): a plain Zustand
// store with an explicit `pushHistory()` call before every mutating action,
// rather than middleware that snapshots on every set(). Explicit is what makes
// undo GRANULAR — dragging a clip produces one undo entry, not one per
// mousemove.
import { create } from 'zustand'
import type {
  AspectRatio,
  ProjectTimeline,
  TextClipStyle,
  TimelineClip,
  TimelineTrack,
  TrackKind,
} from '@/types/anime'
import { HARD_LIMITS } from '@/lib/anime/limits'

/** Clips snap to this many seconds when dragged near a neighbour's edge. */
export const SNAP_THRESHOLD_SEC = 0.15
/** Smallest clip the timeline will produce from a trim or split. */
export const MIN_CLIP_SEC = 0.2

export const DEFAULT_TEXT_STYLE: TextClipStyle = {
  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
  fontSize: 48,
  color: '#FFFFFF',
  align: 'center',
  bold: true,
  italic: false,
  outline: true,
  outlineColor: '#000000',
  shadow: true,
  opacity: 1,
  rotation: 0,
  x: 0.5,
  y: 0.8,
  animation: 'fade',
}

export const DEFAULT_TRANSFORM = { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 }

type Snapshot = { tracks: TimelineTrack[] }

interface VideoEditorState {
  // ── Document ──────────────────────────────────────────
  projectId: string | null
  aspectRatio: AspectRatio
  fps: number
  tracks: TimelineTrack[]

  // ── Selection & playback ──────────────────────────────
  selectedClipId: string | null
  playhead: number
  playing: boolean
  /** Pixels per second — the timeline's zoom level. */
  pixelsPerSecond: number

  // ── Persistence ───────────────────────────────────────
  dirty: boolean
  saving: boolean
  lastSavedAt: number | null

  // ── History ───────────────────────────────────────────
  undoStack: Snapshot[]
  redoStack: Snapshot[]

  // Actions
  load: (projectId: string, timeline: ProjectTimeline | null, fallback: ProjectTimeline) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void

  addTrack: (kind: TrackKind) => void
  removeTrack: (trackId: string) => void
  toggleTrack: (trackId: string, field: 'muted' | 'hidden' | 'locked') => void

  addClip: (trackId: string, clip: Omit<TimelineClip, 'id'>) => string
  updateClip: (clipId: string, patch: Partial<TimelineClip>) => void
  moveClip: (clipId: string, targetTrackId: string, start: number) => void
  removeClip: (clipId: string) => void
  duplicateClip: (clipId: string) => void
  splitClipAtPlayhead: () => void
  trimClip: (clipId: string, edge: 'start' | 'end', deltaSec: number) => void

  select: (clipId: string | null) => void
  setPlayhead: (seconds: number) => void
  setPlaying: (playing: boolean) => void
  setZoom: (pixelsPerSecond: number) => void
  setAspectRatio: (aspectRatio: AspectRatio) => void

  markSaved: () => void
  setSaving: (saving: boolean) => void

  // Derived
  duration: () => number
  findClip: (clipId: string) => { clip: TimelineClip; track: TimelineTrack } | null
  clipsAt: (seconds: number) => { clip: TimelineClip; track: TimelineTrack }[]
}

let clipCounter = 0
function nextClipId(): string {
  clipCounter += 1
  return `clip-${Date.now().toString(36)}-${clipCounter.toString(36)}`
}

function cloneTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => ({ ...clip })) }))
}

/**
 * Every edge on OTHER clips plus the timeline origin — the candidate positions a
 * dragged clip can snap to. Snapping to your own edges would pin a clip in place.
 */
function snapPoints(tracks: TimelineTrack[], excludeClipId: string): number[] {
  const points = [0]
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      points.push(clip.start, clip.start + clip.duration)
    }
  }
  return points
}

function snap(value: number, points: number[]): number {
  let best = value
  let bestDistance = SNAP_THRESHOLD_SEC
  for (const point of points) {
    const distance = Math.abs(point - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = point
    }
  }
  return Math.max(0, best)
}

export const useVideoEditorStore = create<VideoEditorState>((set, get) => ({
  projectId: null,
  aspectRatio: '16:9',
  fps: 24,
  tracks: [],
  selectedClipId: null,
  playhead: 0,
  playing: false,
  pixelsPerSecond: 60,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  undoStack: [],
  redoStack: [],

  load: (projectId, timeline, fallback) => {
    const source = timeline ?? fallback
    set({
      projectId,
      aspectRatio: source.aspectRatio,
      fps: source.fps,
      tracks: cloneTracks(source.tracks),
      selectedClipId: null,
      playhead: 0,
      playing: false,
      dirty: false,
      undoStack: [],
      redoStack: [],
      lastSavedAt: timeline ? Date.now() : null,
    })
  },

  pushHistory: () => {
    const { tracks, undoStack } = get()
    // Capped at 60 entries: enough for a real editing session, bounded so a long
    // session can't grow the heap without limit.
    set({ undoStack: [...undoStack, { tracks: cloneTracks(tracks) }].slice(-60), redoStack: [] })
  },

  undo: () => {
    const { undoStack, redoStack, tracks } = get()
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    set({
      tracks: previous.tracks,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { tracks: cloneTracks(tracks) }].slice(-60),
      dirty: true,
    })
  },

  redo: () => {
    const { undoStack, redoStack, tracks } = get()
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    set({
      tracks: next.tracks,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { tracks: cloneTracks(tracks) }].slice(-60),
      dirty: true,
    })
  },

  addTrack: (kind) => {
    const { tracks, pushHistory } = get()
    if (tracks.length >= HARD_LIMITS.maxTracks) return
    pushHistory()
    const sameKind = tracks.filter((track) => track.kind === kind).length
    const names: Record<TrackKind, string> = { video: 'Video', audio: 'Audio', text: 'Text', effect: 'Effects' }
    set({
      tracks: [
        ...tracks,
        {
          id: `${kind}-${Date.now().toString(36)}`,
          kind,
          name: `${names[kind]} ${sameKind + 1}`,
          clips: [],
          muted: false,
          hidden: false,
          locked: false,
        },
      ],
      dirty: true,
    })
  },

  removeTrack: (trackId) => {
    const { tracks, pushHistory } = get()
    // Never leave the timeline with zero video tracks — there'd be nowhere to
    // drop a clip and no way to get a track back except adding one.
    const track = tracks.find((item) => item.id === trackId)
    if (!track) return
    if (track.kind === 'video' && tracks.filter((item) => item.kind === 'video').length <= 1) return
    pushHistory()
    set({ tracks: tracks.filter((item) => item.id !== trackId), dirty: true })
  },

  toggleTrack: (trackId, field) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, [field]: !track[field] } : track,
      ),
      dirty: true,
    }))
  },

  addClip: (trackId, clip) => {
    const { tracks, pushHistory } = get()
    const track = tracks.find((item) => item.id === trackId)
    if (!track || track.locked || track.clips.length >= HARD_LIMITS.maxClipsPerTrack) return ''
    pushHistory()
    const id = nextClipId()
    set({
      tracks: tracks.map((item) =>
        item.id === trackId
          ? { ...item, clips: [...item.clips, { ...clip, id }].sort((a, b) => a.start - b.start) }
          : item,
      ),
      selectedClipId: id,
      dirty: true,
    })
    return id
  },

  updateClip: (clipId, patch) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
      })),
      dirty: true,
    }))
  },

  moveClip: (clipId, targetTrackId, start) => {
    const { tracks, pushHistory } = get()
    const found = get().findClip(clipId)
    if (!found || found.clip.locked) return
    const target = tracks.find((track) => track.id === targetTrackId)
    // A clip can only live on a track of its own kind — text on a text track,
    // audio on an audio track. Silently refusing is better than a cross-kind
    // clip the renderer can't interpret.
    if (!target || target.locked || target.kind !== found.clip.kind) return

    pushHistory()
    const snapped = snap(Math.max(0, start), snapPoints(tracks, clipId))
    const moved = { ...found.clip, start: snapped }
    set({
      tracks: tracks.map((track) => {
        if (track.id === targetTrackId) {
          const withoutClip = track.clips.filter((clip) => clip.id !== clipId)
          return { ...track, clips: [...withoutClip, moved].sort((a, b) => a.start - b.start) }
        }
        if (track.clips.some((clip) => clip.id === clipId)) {
          return { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
        }
        return track
      }),
      dirty: true,
    })
  },

  removeClip: (clipId) => {
    const { tracks, pushHistory, selectedClipId } = get()
    pushHistory()
    set({
      tracks: tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      })),
      selectedClipId: selectedClipId === clipId ? null : selectedClipId,
      dirty: true,
    })
  },

  duplicateClip: (clipId) => {
    const found = get().findClip(clipId)
    if (!found) return
    const { pushHistory, tracks } = get()
    pushHistory()
    const copy: TimelineClip = {
      ...found.clip,
      id: nextClipId(),
      start: found.clip.start + found.clip.duration,
    }
    set({
      tracks: tracks.map((track) =>
        track.id === found.track.id
          ? { ...track, clips: [...track.clips, copy].sort((a, b) => a.start - b.start) }
          : track,
      ),
      selectedClipId: copy.id,
      dirty: true,
    })
  },

  splitClipAtPlayhead: () => {
    const { playhead, selectedClipId, tracks, pushHistory } = get()
    const found = selectedClipId ? get().findClip(selectedClipId) : null
    if (!found || found.clip.locked) return
    const { clip, track } = found
    const offset = playhead - clip.start
    // Both halves must stay above the minimum, otherwise the split produces a
    // sliver the user can't grab.
    if (offset < MIN_CLIP_SEC || clip.duration - offset < MIN_CLIP_SEC) return

    pushHistory()
    const left: TimelineClip = { ...clip, duration: offset, transitionOut: null }
    const right: TimelineClip = {
      ...clip,
      id: nextClipId(),
      start: clip.start + offset,
      duration: clip.duration - offset,
      // The right half starts further into the source media.
      trimStart: clip.trimStart + offset,
      transitionIn: null,
    }
    set({
      tracks: tracks.map((item) =>
        item.id === track.id
          ? {
              ...item,
              clips: [...item.clips.filter((c) => c.id !== clip.id), left, right].sort(
                (a, b) => a.start - b.start,
              ),
            }
          : item,
      ),
      selectedClipId: right.id,
      dirty: true,
    })
  },

  trimClip: (clipId, edge, deltaSec) => {
    const found = get().findClip(clipId)
    if (!found || found.clip.locked) return
    const { clip } = found
    const { pushHistory } = get()
    pushHistory()

    if (edge === 'start') {
      // Dragging the left edge moves BOTH the timeline position and the offset
      // into the source, so the visible frame under the cursor stays put.
      const delta = Math.max(-clip.trimStart, Math.min(deltaSec, clip.duration - MIN_CLIP_SEC))
      get().updateClip(clipId, {
        start: Math.max(0, clip.start + delta),
        duration: clip.duration - delta,
        trimStart: Math.max(0, clip.trimStart + delta),
      })
      return
    }
    get().updateClip(clipId, { duration: Math.max(MIN_CLIP_SEC, clip.duration + deltaSec) })
  },

  select: (clipId) => set({ selectedClipId: clipId }),
  setPlayhead: (seconds) => set({ playhead: Math.max(0, seconds) }),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pixelsPerSecond) => set({ pixelsPerSecond: Math.min(400, Math.max(10, pixelsPerSecond)) }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio, dirty: true }),

  markSaved: () => set({ dirty: false, saving: false, lastSavedAt: Date.now() }),
  setSaving: (saving) => set({ saving }),

  duration: () => {
    const { tracks } = get()
    let end = 0
    for (const track of tracks) {
      for (const clip of track.clips) {
        end = Math.max(end, clip.start + clip.duration)
      }
    }
    return end
  },

  findClip: (clipId) => {
    for (const track of get().tracks) {
      const clip = track.clips.find((item) => item.id === clipId)
      if (clip) return { clip, track }
    }
    return null
  },

  clipsAt: (seconds) => {
    const out: { clip: TimelineClip; track: TimelineTrack }[] = []
    for (const track of get().tracks) {
      if (track.hidden) continue
      for (const clip of track.clips) {
        if (clip.hidden) continue
        if (seconds >= clip.start && seconds < clip.start + clip.duration) out.push({ clip, track })
      }
    }
    return out
  },
}))
