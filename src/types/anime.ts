import type { FirestoreTimestamp } from './user'
import type { ContentGenre } from './novel'

// ── Anime Studio domain types ───────────────────────────────
//
// The Anime Studio turns a prompt into video CLIPS ("scenes") that live inside a
// PROJECT, which the editor then arranges on a multi-track timeline. Generation
// itself is asynchronous: a scene never holds a video directly, it holds the id
// of a GenerationJob whose completion writes the storage key back onto it.
//
// IMPORTANT: nothing in this file implies a video was produced. A scene with
// `status: 'idle'` and no `storageKey` is the honest default — the UI must show
// it as "not generated yet", never as a placeholder clip.

export type AnimeProjectStatus = 'draft' | 'published' | 'archived'
export type AnimeVisibility = 'private' | 'unlisted' | 'public'

/** Lifecycle of one asynchronous generation job. Mirrors GenerationJob.status. */
export type GenerationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** Terminal job states — no further progress will ever be reported. */
export const TERMINAL_JOB_STATUSES: readonly GenerationJobStatus[] = [
  'completed',
  'failed',
  'cancelled',
]

/**
 * A scene's own state, derived from its latest job. `idle` means "described but
 * never generated" — the state every scene starts in.
 */
export type SceneStatus = 'idle' | 'queued' | 'processing' | 'ready' | 'failed'

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
export type ResolutionId = '480p' | '720p' | '1080p'

/** What the generation request asks the provider for. Validated server-side. */
export interface GenerationSettings {
  prompt: string
  negativePrompt: string
  /** Broad treatment — trailer, short, cinematic sequence… */
  videoStyle: string
  /** Anime art direction — shonen, shojo, retro cel, dark fantasy… */
  animeStyle: string
  cameraMovement: string
  environment: string
  lighting: string
  mood: string
  aspectRatio: AspectRatio
  durationSec: number
  resolution: ResolutionId
  fps: number
  /** Deterministic seed. Omitted = provider picks one (recorded on the job). */
  seed?: number
  /** Character ids reused across scenes — the consistency anchor. */
  characterIds: string[]
  audio: {
    /** Music bed preset id, or 'none'. */
    music: string
    /** Ask the provider for ambient/impact SFX where supported. */
    sfx: boolean
  }
}

export interface AnimeProject {
  id: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string | null
  title: string
  description: string
  /**
   * Poster frame — doubles as the CATALOG COVER once published, which is why
   * publishing requires one. Null until a scene has been generated and promoted.
   */
  thumbnailURL: string | null
  status: AnimeProjectStatus
  visibility: AnimeVisibility
  /**
   * Catalog genres, shared vocabulary with novels/webtoons (GENRES in
   * lib/utils/constants) so Browse can filter all three content types with one
   * control instead of a per-type taxonomy.
   */
  genres: ContentGenre[]
  /**
   * Server-managed engagement counters, same contract as novels/webtoons:
   * viewCount moves only through /api/art/view (Admin SDK), likeCount only
   * through the delta-bounded rule. A client may never write either.
   */
  viewCount: number
  likeCount: number
  /** Denormalized counters — kept in step by the scene service. */
  sceneCount: number
  durationSec: number
  /** Project-wide defaults that new scenes inherit. */
  defaults: Pick<
    GenerationSettings,
    'animeStyle' | 'videoStyle' | 'aspectRatio' | 'resolution' | 'fps'
  >
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

export interface AnimeScene {
  id: string
  projectId: string
  ownerId: string
  title: string
  prompt: string
  settings: GenerationSettings
  /** The most recent job for this scene. Null before the first generation. */
  generationJobId: string | null
  status: SceneStatus
  /**
   * Private Storage object path (NOT a public URL). Playback goes through a
   * short-lived signed URL minted by /api/anime/assets. Null until a job
   * completes — a non-null value means real bytes exist in the bucket.
   */
  storageKey: string | null
  /** Poster frame storage path, same signing rules as `storageKey`. */
  posterKey: string | null
  /** Real clip length reported by the provider, in seconds. 0 while ungenerated. */
  durationSec: number
  order: number
  /** Free-form provider metadata (seed actually used, model id, …). */
  metadata: Record<string, string | number | boolean>
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

/**
 * One asynchronous generation request. Written ONLY by the server (Admin SDK) —
 * clients read their own jobs to drive progress UI and can never fabricate a
 * `completed` job or point one at someone else's project.
 */
export interface GenerationJob {
  id: string
  ownerId: string
  projectId: string
  sceneId: string
  /** Registered provider id that accepted the job (see lib/anime/provider). */
  provider: string
  /** Provider-side job handle, used to poll status. */
  providerJobId: string | null
  status: GenerationJobStatus
  /** 0–100. Providers that don't report progress stay at 0 until completion. */
  progress: number
  settings: GenerationSettings
  /** Set on success — the same value copied onto the scene. */
  storageKey: string | null
  /** Machine-readable failure cause; `message` is the user-facing text. */
  error: { code: string; message: string } | null
  /** Idempotency key — blocks duplicate submissions of the same request. */
  requestHash: string
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  completedAt: FirestoreTimestamp | null
}

// ── Character consistency ───────────────────────────────────

/**
 * A reusable character. Scenes reference characters by ID, so the same
 * description (and reference images) is fed to every generation — that
 * persistent reference is what makes a character recognisable across scenes.
 */
export interface AnimeCharacter {
  id: string
  ownerId: string
  name: string
  appearance: string
  clothing: string
  hair: string
  eyes: string
  age: string
  personality: string
  /** Voice preset id used by AI Voice, or '' for none. */
  voice: string
  /** Public Storage download URLs for reference art (owner-uploaded). */
  referenceImages: string[]
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

// ── Editor timeline ─────────────────────────────────────────

export type TrackKind = 'video' | 'audio' | 'text' | 'effect'

export interface ClipTransition {
  /** Transition preset id (see lib/anime/presets TRANSITIONS). */
  type: string
  durationSec: number
}

/** Text styling for a text-track clip. */
export interface TextClipStyle {
  fontFamily: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  outline: boolean
  outlineColor: string
  shadow: boolean
  opacity: number
  rotation: number
  /** Position as a fraction of the frame (0–1), so it survives resolution changes. */
  x: number
  y: number
  /** Text animation preset id, or 'none'. */
  animation: string
}

export interface TimelineClip {
  id: string
  kind: TrackKind
  /** Position on the timeline, seconds from project start. */
  start: number
  /** Rendered length on the timeline, seconds. */
  duration: number
  /** For video/audio: offset into the SOURCE media where playback begins. */
  trimStart: number
  /** Source scene id (video) — resolves to a signed URL at playback time. */
  sceneId?: string
  /** Source audio asset id (audio clips). */
  audioId?: string
  /** Text content (text clips). */
  text?: string
  textStyle?: TextClipStyle
  /** Effect preset id (effect clips). */
  effect?: string
  /** Effect strength, 0–1. */
  intensity?: number
  volume?: number
  fadeInSec?: number
  fadeOutSec?: number
  transitionIn?: ClipTransition | null
  transitionOut?: ClipTransition | null
  /** Visual transform for video clips. */
  transform?: { scale: number; x: number; y: number; rotation: number; opacity: number }
  locked?: boolean
  muted?: boolean
  hidden?: boolean
}

export interface TimelineTrack {
  id: string
  kind: TrackKind
  name: string
  clips: TimelineClip[]
  muted: boolean
  hidden: boolean
  locked: boolean
}

/**
 * The saved editor document. Stored at
 * animeProjects/{projectId}/editor/timeline so a project read doesn't have to
 * pull the whole timeline.
 */
export interface ProjectTimeline {
  version: 1
  aspectRatio: AspectRatio
  fps: number
  tracks: TimelineTrack[]
  updatedAt: FirestoreTimestamp | null
}

/** A saved snapshot for version history / recovery. */
export interface TimelineRevision {
  id: string
  label: string
  timeline: Omit<ProjectTimeline, 'updatedAt'>
  createdAt: FirestoreTimestamp
}

// ── AI storyboard ───────────────────────────────────────────

/** One planned beat returned by the AI Storyboard tool, before generation. */
export interface StoryboardBeat {
  title: string
  prompt: string
  durationSec: number
  cameraMovement: string
  mood: string
}
