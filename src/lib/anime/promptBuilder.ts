// Composes the final vendor prompt from the creator's description, the chosen
// presets and any attached characters.
//
// The character block is what makes CHARACTER CONSISTENCY work: a character is a
// stored, stable description, and every scene that references its id gets the
// exact same words prepended. That is a structural guarantee (same id → same
// text) rather than a hope that the model remembers.
import type { AnimeCharacter, GenerationSettings } from '@/types/anime'
import {
  ANIME_STYLES,
  CAMERA_MOVEMENTS,
  ENVIRONMENT_PRESETS,
  LIGHTING_PRESETS,
  MOOD_PRESETS,
  VIDEO_STYLES,
  labelOf,
} from './presets'

/** Collapse whitespace and trim — vendor prompts are sensitive to noise. */
function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** One character rendered as a compact, stable descriptor. */
export function describeCharacter(character: AnimeCharacter): string {
  const parts = [
    character.name,
    character.age && `${clean(character.age)}`,
    character.hair && `${clean(character.hair)} hair`,
    character.eyes && `${clean(character.eyes)} eyes`,
    character.clothing && `wearing ${clean(character.clothing)}`,
    character.appearance && clean(character.appearance),
  ].filter(Boolean)
  return parts.join(', ')
}

export interface ComposedPrompt {
  prompt: string
  negativePrompt: string
}

/**
 * Build the prompt actually sent to the provider. Kept pure and dependency-free
 * so it can be unit-tested and called from either side of the wire (the client
 * previews it; the server rebuilds it authoritatively before submitting — the
 * client's copy is never trusted).
 */
export function composePrompt(
  settings: GenerationSettings,
  characters: AnimeCharacter[],
): ComposedPrompt {
  const segments: string[] = []

  segments.push(`${labelOf(ANIME_STYLES, settings.animeStyle)} anime`)
  segments.push(labelOf(VIDEO_STYLES, settings.videoStyle).toLowerCase())

  if (characters.length > 0) {
    segments.push(`featuring ${characters.map(describeCharacter).join('; ')}`)
  }

  segments.push(clean(settings.prompt))

  if (settings.environment && settings.environment !== 'auto') {
    segments.push(`${labelOf(ENVIRONMENT_PRESETS, settings.environment).toLowerCase()} setting`)
  }
  segments.push(`${labelOf(LIGHTING_PRESETS, settings.lighting).toLowerCase()} lighting`)
  segments.push(`${labelOf(MOOD_PRESETS, settings.mood).toLowerCase()} mood`)
  segments.push(`${labelOf(CAMERA_MOVEMENTS, settings.cameraMovement).toLowerCase()} camera`)
  segments.push('smooth motion, consistent character design, high quality animation')

  // Baseline negatives every anime generation wants, plus the creator's own.
  const negatives = [
    'text, watermark, logo, subtitles',
    'distorted anatomy, extra limbs, flickering, morphing faces',
    'low quality, blurry, compression artifacts',
    clean(settings.negativePrompt),
  ].filter(Boolean)

  return {
    prompt: segments.filter(Boolean).join(', '),
    negativePrompt: negatives.join(', '),
  }
}

/**
 * Stable fingerprint of a generation request. Two identical submissions produce
 * the same hash, which the job store uses to reject accidental duplicates (a
 * double-click, a retried fetch) before they cost a second vendor call.
 *
 * A seeded request is deliberately included in the hash: re-rolling with a NEW
 * seed is a legitimately different request, re-submitting the SAME seed is not.
 */
export function requestFingerprint(sceneId: string, settings: GenerationSettings): string {
  const canonical = JSON.stringify({
    sceneId,
    p: clean(settings.prompt),
    n: clean(settings.negativePrompt),
    v: settings.videoStyle,
    a: settings.animeStyle,
    c: settings.cameraMovement,
    e: settings.environment,
    l: settings.lighting,
    m: settings.mood,
    r: settings.aspectRatio,
    d: settings.durationSec,
    res: settings.resolution,
    f: settings.fps,
    s: settings.seed ?? null,
    ch: [...settings.characterIds].sort(),
  })
  // Non-cryptographic (FNV-1a) — this is a collision-avoidance key for
  // idempotency, not a security boundary.
  let hash = 0x811c9dc5
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16)}-${canonical.length.toString(16)}`
}
