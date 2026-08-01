/**
 * Webtoon FORMAT spec — the single source of truth for what makes a generated
 * chapter read as ONE continuous long-vertical scroll instead of a stack of
 * separate, framed "pages".
 *
 * This encodes long-vertical manhwa layout CONVENTIONS (full-bleed art, variable
 * panel heights per camera shot, one locked look) — it is NOT trained on, nor a
 * copy of, any specific studio's artwork. Both the client (canvas + painter) and
 * the server image route import from here so panel sizing can never drift apart.
 *
 * Pure module: no React, no Konva, no browser APIs — safe to import from a
 * Next.js route handler and from client code alike.
 */

/**
 * Camera framing for a beat. The Story Director picks one per panel; it drives
 * BOTH the panel's height (tall establishing shots vs short reaction beats give
 * the scroll rhythm) and the aspect ratio the image is generated at (so the art
 * is never squashed to fit the page).
 */
export const SHOT_TYPES = ['establishing', 'action', 'standard', 'closeup', 'reaction'] as const
export type ShotType = (typeof SHOT_TYPES)[number]

/** Every panel shares ONE width so the merged column has clean, straight edges. */
export const WEBTOON_PANEL_WIDTH = 832

/**
 * Height per shot type. Uniform equal rectangles read as "pages"; varying the
 * height by shot is what gives a real webtoon its vertical pacing. All values are
 * multiples of 64 (Flux requires it) and the page uses these EXACT dimensions so
 * the generated image fills it edge-to-edge with no stretch.
 */
export const PANEL_SIZES: Record<ShotType, { width: number; height: number }> = {
  establishing: { width: WEBTOON_PANEL_WIDTH, height: 1600 }, // huge wide environment / scenery
  action: { width: WEBTOON_PANEL_WIDTH, height: 1472 }, // dynamic full-body movement / impact
  standard: { width: WEBTOON_PANEL_WIDTH, height: 1280 }, // medium shot, waist-up
  closeup: { width: WEBTOON_PANEL_WIDTH, height: 1088 }, // face / hands / key object
  reaction: { width: WEBTOON_PANEL_WIDTH, height: 832 }, // tight beat, single expression / small detail
}

export const DEFAULT_SHOT: ShotType = 'standard'

/** Coerce an untrusted string to a known shot type, falling back to standard. */
export function asShot(v: unknown): ShotType {
  return typeof v === 'string' && (SHOT_TYPES as readonly string[]).includes(v)
    ? (v as ShotType)
    : DEFAULT_SHOT
}

/** Page + image dimensions for a shot (both the same, so art never stretches). */
export function panelSize(shot?: string): { width: number; height: number } {
  return PANEL_SIZES[asShot(shot)]
}

/**
 * Style fragment appended to EVERY panel prompt. Its whole job is to kill the
 * "separate page" look: the art must run to all four edges with no border, frame
 * or margin, so consecutive panels butt together as one continuous scroll.
 */
export const FULLBLEED_STYLE =
  ' full-bleed vertical composition that fills the frame edge to edge,' +
  ' no panel border, no frame, no gutter, no margin, no rounded corners,'
