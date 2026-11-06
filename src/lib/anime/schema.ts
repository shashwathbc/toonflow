// Zod schemas for every Anime Studio request body.
//
// These are the SERVER's definition of a valid request. The client builds the
// same shapes, but nothing here trusts that — every field is re-bounded here,
// including ones the UI can only produce within range (a select can't emit an
// out-of-range value; a curl command can).
import { z } from 'zod'
import {
  ANIME_STYLE_IDS,
  CAMERA_MOVEMENT_IDS,
  EFFECT_IDS,
  ENVIRONMENT_IDS,
  FPS_OPTIONS,
  LIGHTING_IDS,
  MOOD_IDS,
  MUSIC_IDS,
  TRANSITION_IDS,
  VIDEO_STYLE_IDS,
} from './presets'
import { HARD_LIMITS } from './limits'

/** A non-empty enum from a runtime string[] (zod needs a tuple type). */
const oneOf = (values: readonly string[]) => z.enum(values as [string, ...string[]])

export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5', '21:9'])
export const resolutionSchema = z.enum(['480p', '720p', '1080p'])

export const generationSettingsSchema = z.object({
  prompt: z.string().trim().min(8, 'Describe the scene in a little more detail').max(HARD_LIMITS.promptMaxChars),
  negativePrompt: z.string().trim().max(HARD_LIMITS.negativePromptMaxChars).default(''),
  videoStyle: oneOf(VIDEO_STYLE_IDS),
  animeStyle: oneOf(ANIME_STYLE_IDS),
  cameraMovement: oneOf(CAMERA_MOVEMENT_IDS),
  environment: oneOf(ENVIRONMENT_IDS),
  lighting: oneOf(LIGHTING_IDS),
  mood: oneOf(MOOD_IDS),
  aspectRatio: aspectRatioSchema,
  durationSec: z.number().int().min(HARD_LIMITS.minDurationSec).max(HARD_LIMITS.maxDurationSec),
  resolution: resolutionSchema,
  fps: z.number().int().refine((n) => (FPS_OPTIONS as readonly number[]).includes(n), 'Unsupported frame rate'),
  seed: z.number().int().min(0).max(4_000_000_000).optional(),
  characterIds: z.array(z.string().min(1).max(128)).max(HARD_LIMITS.maxCharactersPerScene).default([]),
  audio: z
    .object({ music: oneOf(MUSIC_IDS), sfx: z.boolean() })
    .default({ music: 'none', sfx: false }),
})

export type GenerationSettingsInput = z.infer<typeof generationSettingsSchema>

/** POST /api/anime/jobs — submit one scene for generation. */
export const createJobSchema = z.object({
  projectId: z.string().min(1).max(128),
  sceneId: z.string().min(1).max(128),
  settings: generationSettingsSchema,
  /**
   * `extend` continues an existing clip rather than starting fresh; `regenerate`
   * re-rolls the same scene. Recorded on the job so the provider can branch and
   * so analytics can tell the two apart.
   */
  intent: z.enum(['generate', 'regenerate', 'extend']).default('generate'),
})

/** POST /api/anime/storyboard — plan a story into scene beats. */
export const storyboardSchema = z.object({
  projectId: z.string().min(1).max(128),
  story: z.string().trim().min(12).max(HARD_LIMITS.promptMaxChars),
  targetDurationSec: z.number().int().min(10).max(300),
  animeStyle: oneOf(ANIME_STYLE_IDS),
  sceneCount: z.number().int().min(2).max(HARD_LIMITS.maxStoryboardBeats).optional(),
})

/** POST /api/anime/assets — mint a short-lived signed playback URL. */
export const signAssetSchema = z.object({
  projectId: z.string().min(1).max(128),
  sceneId: z.string().min(1).max(128),
  kind: z.enum(['video', 'poster']).default('video'),
})

// ── Timeline persistence ────────────────────────────────────

const transformSchema = z.object({
  scale: z.number().min(0.05).max(10),
  x: z.number().min(-5).max(5),
  y: z.number().min(-5).max(5),
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
})

const textStyleSchema = z.object({
  fontFamily: z.string().max(120),
  fontSize: z.number().min(4).max(400),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  align: z.enum(['left', 'center', 'right']),
  bold: z.boolean(),
  italic: z.boolean(),
  outline: z.boolean(),
  outlineColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  shadow: z.boolean(),
  opacity: z.number().min(0).max(1),
  rotation: z.number().min(-360).max(360),
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  animation: z.string().max(40),
})

const transitionSchema = z.object({
  type: oneOf(TRANSITION_IDS),
  durationSec: z.number().min(0).max(5),
})

const clipSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(['video', 'audio', 'text', 'effect']),
  start: z.number().min(0).max(36_000),
  duration: z.number().min(0.05).max(3_600),
  trimStart: z.number().min(0).max(36_000),
  sceneId: z.string().max(128).optional(),
  audioId: z.string().max(128).optional(),
  text: z.string().max(2000).optional(),
  textStyle: textStyleSchema.optional(),
  effect: oneOf(EFFECT_IDS).optional(),
  intensity: z.number().min(0).max(1).optional(),
  volume: z.number().min(0).max(2).optional(),
  fadeInSec: z.number().min(0).max(10).optional(),
  fadeOutSec: z.number().min(0).max(10).optional(),
  transitionIn: transitionSchema.nullable().optional(),
  transitionOut: transitionSchema.nullable().optional(),
  transform: transformSchema.optional(),
  locked: z.boolean().optional(),
  muted: z.boolean().optional(),
  hidden: z.boolean().optional(),
})

const trackSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(['video', 'audio', 'text', 'effect']),
  name: z.string().max(80),
  clips: z.array(clipSchema).max(HARD_LIMITS.maxClipsPerTrack),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
})

export const timelineSchema = z.object({
  version: z.literal(1),
  aspectRatio: aspectRatioSchema,
  fps: z.number().int().refine((n) => (FPS_OPTIONS as readonly number[]).includes(n)),
  tracks: z.array(trackSchema).max(HARD_LIMITS.maxTracks),
})

export type TimelineInput = z.infer<typeof timelineSchema>
