// Creative presets for the Anime Studio, shared by the prompt UI, the editor and
// the server-side request validator. Declared once so a value the UI can offer
// is always a value the API accepts — a select option that fails validation is
// a bug the type system should catch, not a runtime 400.
import type { AspectRatio, ResolutionId } from '@/types/anime'

export interface Preset {
  id: string
  label: string
  /** One-line help shown under the control / in the option list. */
  hint: string
}

/** Broad treatment of the sequence. Drives the prompt's framing language. */
export const VIDEO_STYLES = [
  { id: 'cinematic', label: 'Cinematic Scene', hint: 'Film-grade shot with depth and motion' },
  { id: 'trailer', label: 'Trailer', hint: 'High-energy cuts, dramatic build' },
  { id: 'short', label: 'Anime Short', hint: 'Self-contained story beat' },
  { id: 'opening', label: 'Opening Sequence', hint: 'Stylised montage, title-card energy' },
  { id: 'action', label: 'Action Sequence', hint: 'Fast choreography and impact frames' },
  { id: 'slice-of-life', label: 'Slice of Life', hint: 'Calm, grounded, everyday framing' },
] as const satisfies readonly Preset[]

/** Art direction. This is the strongest lever on how the output looks. */
export const ANIME_STYLES = [
  { id: 'modern-anime', label: 'Modern Anime', hint: 'Clean lines, vivid colour, current TV look' },
  { id: 'shonen', label: 'Shonen Action', hint: 'Bold outlines, speed lines, high contrast' },
  { id: 'shojo', label: 'Shojo', hint: 'Soft palette, delicate linework, sparkle' },
  { id: 'dark-fantasy', label: 'Dark Fantasy', hint: 'Heavy shadow, muted blood-tone palette' },
  { id: 'retro-90s', label: 'Retro 90s Cel', hint: 'Film grain, hand-painted cel look' },
  { id: 'cyberpunk', label: 'Cyberpunk', hint: 'Neon, rain, dense city detail' },
  { id: 'ghibli-esque', label: 'Painterly', hint: 'Watercolour backgrounds, warm naturalism' },
  { id: 'chibi', label: 'Chibi', hint: 'Super-deformed, comedic proportions' },
] as const satisfies readonly Preset[]

export const CAMERA_MOVEMENTS = [
  { id: 'static', label: 'Static', hint: 'Locked-off frame' },
  { id: 'slow-pan', label: 'Slow Pan', hint: 'Gentle horizontal drift' },
  { id: 'dolly-in', label: 'Dolly In', hint: 'Push toward the subject' },
  { id: 'dolly-out', label: 'Dolly Out', hint: 'Pull back to reveal' },
  { id: 'crane', label: 'Crane', hint: 'Sweeping vertical move' },
  { id: 'handheld', label: 'Handheld', hint: 'Loose, urgent framing' },
  { id: 'orbit', label: 'Orbit', hint: 'Circle the subject' },
  { id: 'tracking', label: 'Tracking', hint: 'Follow the subject in motion' },
] as const satisfies readonly Preset[]

export const LIGHTING_PRESETS = [
  { id: 'natural', label: 'Natural', hint: 'Even daylight' },
  { id: 'golden-hour', label: 'Golden Hour', hint: 'Warm low sun, long shadows' },
  { id: 'night', label: 'Night', hint: 'Cool ambient, practical highlights' },
  { id: 'neon', label: 'Neon', hint: 'Saturated coloured sources' },
  { id: 'backlit', label: 'Backlit', hint: 'Rim light, silhouette emphasis' },
  { id: 'storm', label: 'Storm', hint: 'Flat grey with lightning accents' },
  { id: 'candlelit', label: 'Candlelit', hint: 'Warm flicker, deep falloff' },
] as const satisfies readonly Preset[]

export const MOOD_PRESETS = [
  { id: 'epic', label: 'Epic', hint: 'Grand, sweeping, heroic' },
  { id: 'tense', label: 'Tense', hint: 'Held breath before impact' },
  { id: 'melancholy', label: 'Melancholy', hint: 'Quiet, wistful, restrained' },
  { id: 'hopeful', label: 'Hopeful', hint: 'Bright, rising, warm' },
  { id: 'ominous', label: 'Ominous', hint: 'Something is wrong' },
  { id: 'playful', label: 'Playful', hint: 'Light and comedic' },
] as const satisfies readonly Preset[]

export const ENVIRONMENT_PRESETS = [
  { id: 'auto', label: 'From prompt', hint: 'Let the description decide' },
  { id: 'city', label: 'City', hint: 'Dense urban streets' },
  { id: 'mountain', label: 'Mountain', hint: 'Peaks, cliffs, open sky' },
  { id: 'forest', label: 'Forest', hint: 'Dense canopy and undergrowth' },
  { id: 'school', label: 'School', hint: 'Classrooms, rooftops, corridors' },
  { id: 'interior', label: 'Interior', hint: 'Rooms and enclosed spaces' },
  { id: 'space', label: 'Space', hint: 'Orbit, stars, void' },
  { id: 'ruins', label: 'Ruins', hint: 'Broken architecture, overgrowth' },
] as const satisfies readonly Preset[]

export const MUSIC_PRESETS = [
  { id: 'none', label: 'No music', hint: 'Silent — add your own track later' },
  { id: 'orchestral', label: 'Orchestral', hint: 'Strings and brass, cinematic' },
  { id: 'lofi', label: 'Lo-fi', hint: 'Warm, slow, understated' },
  { id: 'rock', label: 'Rock', hint: 'Driving guitars, high energy' },
  { id: 'synth', label: 'Synthwave', hint: 'Retro electronic pulse' },
  { id: 'traditional', label: 'Traditional', hint: 'Koto, shakuhachi, taiko' },
] as const satisfies readonly Preset[]

export const ASPECT_RATIOS = [
  { id: '16:9', label: 'Landscape 16:9', hint: 'YouTube, desktop' },
  { id: '9:16', label: 'Vertical 9:16', hint: 'Shorts, Reels, TikTok' },
  { id: '1:1', label: 'Square 1:1', hint: 'Feed posts' },
  { id: '4:5', label: 'Portrait 4:5', hint: 'Instagram portrait' },
  { id: '21:9', label: 'Cinemascope 21:9', hint: 'Widescreen film bars' },
] as const satisfies readonly { id: AspectRatio; label: string; hint: string }[]

export const RESOLUTIONS = [
  { id: '480p', label: '480p', hint: 'Fastest — good for drafts' },
  { id: '720p', label: '720p HD', hint: 'Balanced quality and speed' },
  { id: '1080p', label: '1080p Full HD', hint: 'Highest quality, slowest' },
] as const satisfies readonly { id: ResolutionId; label: string; hint: string }[]

export const FPS_OPTIONS = [12, 24, 30] as const

/** Pixel dimensions per aspect ratio × resolution. Multiples of 8 for encoders. */
const RESOLUTION_HEIGHT: Record<ResolutionId, number> = { '480p': 480, '720p': 720, '1080p': 1080 }
const ASPECT_VALUE: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '21:9': 21 / 9,
}

/** Frame size for an aspect/resolution pair, snapped to a multiple of 8. */
export function frameSize(aspect: AspectRatio, resolution: ResolutionId): { width: number; height: number } {
  const base = RESOLUTION_HEIGHT[resolution]
  const ratio = ASPECT_VALUE[aspect]
  // For portrait ratios the SHORT edge is the width, so cap the long edge at
  // the nominal resolution instead of blowing the height past 1080.
  const height = ratio >= 1 ? base : Math.round(base / ratio)
  const width = Math.round(height * ratio)
  const snap = (n: number) => Math.max(8, Math.round(n / 8) * 8)
  return { width: snap(width), height: snap(height) }
}

/** CSS aspect-ratio value for previews (`16 / 9`). */
export function aspectCss(aspect: AspectRatio): string {
  return aspect.replace(':', ' / ')
}

// ── Editor presets ──────────────────────────────────────────

export const TRANSITIONS = [
  { id: 'none', label: 'None', hint: 'Hard cut' },
  { id: 'fade', label: 'Fade', hint: 'Fade through black' },
  { id: 'dissolve', label: 'Dissolve', hint: 'Cross-dissolve between clips' },
  { id: 'zoom', label: 'Zoom', hint: 'Push through the frame' },
  { id: 'slide', label: 'Slide', hint: 'Push in from the edge' },
  { id: 'blur', label: 'Blur', hint: 'Defocus between shots' },
  { id: 'flash', label: 'Flash', hint: 'White impact frame' },
] as const satisfies readonly Preset[]

export const EFFECTS = [
  { id: 'glow', label: 'Glow', hint: 'Soft bloom on highlights' },
  { id: 'motion-blur', label: 'Motion Blur', hint: 'Directional smear' },
  { id: 'shake', label: 'Shake', hint: 'Camera impact tremor' },
  { id: 'flash', label: 'Flash', hint: 'Strobing impact light' },
  { id: 'smoke', label: 'Smoke', hint: 'Drifting haze overlay' },
  { id: 'fire', label: 'Fire', hint: 'Embers and heat' },
  { id: 'lightning', label: 'Lightning', hint: 'Electric arcs' },
  { id: 'particles', label: 'Particles', hint: 'Floating motes' },
  { id: 'speed-lines', label: 'Speed Lines', hint: 'Classic anime motion streaks' },
  { id: 'vignette', label: 'Cinematic Vignette', hint: 'Darkened edges' },
  { id: 'grain', label: 'Film Grain', hint: 'Analogue texture' },
  { id: 'chromatic', label: 'Chromatic Shift', hint: 'RGB split on impact' },
] as const satisfies readonly Preset[]

export const TEXT_ANIMATIONS = [
  { id: 'none', label: 'None', hint: 'Static' },
  { id: 'fade', label: 'Fade In', hint: 'Opacity ramp' },
  { id: 'slide-up', label: 'Slide Up', hint: 'Rise into place' },
  { id: 'typewriter', label: 'Typewriter', hint: 'Character by character' },
  { id: 'pop', label: 'Pop', hint: 'Scale punch' },
] as const satisfies readonly Preset[]

/** Web-safe stacks only — no external font host (the CSP blocks those). */
export const TEXT_FONTS = [
  { id: 'inter', label: 'Inter', stack: 'var(--font-inter), Inter, system-ui, sans-serif' },
  { id: 'system', label: 'System Sans', stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monospace', stack: 'ui-monospace, Menlo, Consolas, monospace' },
  { id: 'impact', label: 'Display', stack: 'Impact, "Arial Black", system-ui, sans-serif' },
] as const

export const VOICE_PRESETS = [
  { id: '', label: 'No voice', hint: 'Silent character' },
  { id: 'young-male', label: 'Young Male', hint: 'Bright, energetic' },
  { id: 'young-female', label: 'Young Female', hint: 'Clear, warm' },
  { id: 'deep-male', label: 'Deep Male', hint: 'Low, commanding' },
  { id: 'mature-female', label: 'Mature Female', hint: 'Measured, composed' },
  { id: 'narrator', label: 'Narrator', hint: 'Neutral storytelling voice' },
] as const satisfies readonly Preset[]

// ── Derived id unions + guards (used by the zod schemas) ────

// Widened to `string[]` on purpose. These lists are used to VALIDATE untrusted
// input (request bodies, AI output), where the value being checked is a plain
// string — a `readonly ('static' | 'orbit' | …)[]` would make `.includes(value)`
// a type error at exactly the call sites that need it most. The narrow literal
// types stay available through the source arrays above.
export const VIDEO_STYLE_IDS: string[] = VIDEO_STYLES.map((s) => s.id)
export const ANIME_STYLE_IDS: string[] = ANIME_STYLES.map((s) => s.id)
export const CAMERA_MOVEMENT_IDS: string[] = CAMERA_MOVEMENTS.map((s) => s.id)
export const LIGHTING_IDS: string[] = LIGHTING_PRESETS.map((s) => s.id)
export const MOOD_IDS: string[] = MOOD_PRESETS.map((s) => s.id)
export const ENVIRONMENT_IDS: string[] = ENVIRONMENT_PRESETS.map((s) => s.id)
export const MUSIC_IDS: string[] = MUSIC_PRESETS.map((s) => s.id)
export const TRANSITION_IDS: string[] = TRANSITIONS.map((s) => s.id)
export const EFFECT_IDS: string[] = EFFECTS.map((s) => s.id)

/** Label lookup for any preset list — used by read-only summaries. */
export function labelOf(list: readonly Preset[], id: string): string {
  return list.find((p) => p.id === id)?.label ?? id
}
