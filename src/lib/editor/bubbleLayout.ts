// ---------------------------------------------------------------------------
// Panel dialogue LAYOUT — the pass that makes an AI-planned page read like a real
// long-scroll webtoon instead of a pile of overlapping boxes.
//
// Two jobs:
//   1. size each speech bubble (and SFX caption) to the words it actually holds,
//      so a short line ("Ravana.") gets a small bubble and a long line wraps into
//      a taller one — never a fixed 340px box the text rattles around in.
//   2. flow every bubble + SFX down the panel's safe area top-to-bottom with a
//      guaranteed vertical gap, so NOTHING overlaps anything else.
//
// Pure geometry + (client-only) canvas text measurement. No Konva, no store, no
// React — the agent workflow calls layoutPanelDialogue() and drops the returned
// specs straight onto the page.
// ---------------------------------------------------------------------------

import {
  getBubbleDef,
  makeBubbleSpec,
  type BubbleKind,
  type BubbleSpec,
} from './bubbles'

const LINE_HEIGHT = 1.28

// Storyboard placement zone → fractional center on the page (0–1). The x is a
// horizontal BIAS (kept if it fits); the y seeds reading order for the vertical
// flow below.
const ZONE: Record<string, { x: number; y: number }> = {
  'top-left': { x: 0.32, y: 0.16 }, 'top-center': { x: 0.5, y: 0.16 }, 'top-right': { x: 0.68, y: 0.16 },
  'mid-left': { x: 0.32, y: 0.5 }, center: { x: 0.5, y: 0.5 }, 'mid-right': { x: 0.68, y: 0.5 },
  'bottom-left': { x: 0.32, y: 0.84 }, 'bottom-center': { x: 0.5, y: 0.84 }, 'bottom-right': { x: 0.68, y: 0.84 },
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi))

// --- text measurement -------------------------------------------------------
// One reused offscreen canvas. Falls back to an average-glyph estimate when
// there's no DOM (SSR / tests) so callers never crash — the workflow only ever
// runs this in the browser, where the real measurement kicks in.
let measureCanvas: HTMLCanvasElement | null = null
function measureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  return measureCanvas.getContext('2d')
}

function fontString(fontSize: number, fontFamily: string, fontStyle: string): string {
  const weight = /bold/i.test(fontStyle) ? '700' : '400'
  const italic = /italic/i.test(fontStyle) ? 'italic' : 'normal'
  return `${italic} ${weight} ${fontSize}px ${fontFamily}, sans-serif`
}

interface Wrapped {
  /** Width of the widest wrapped line, in px. */
  width: number
  /** Total text-block height, in px. */
  height: number
  lineCount: number
}

/**
 * Greedily word-wrap `text` to at most `maxWidth` and report the block's real
 * width/height at the given font. A single word longer than `maxWidth` is kept
 * whole (the box just grows to it) so words are never chopped.
 */
function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
): Wrapped {
  const ctx = measureCtx()
  if (ctx) ctx.font = fontString(fontSize, fontFamily, fontStyle)
  const measure = (s: string) => (ctx ? ctx.measureText(s).width : s.length * fontSize * 0.52)

  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  if (lines.length === 0) lines.push('')

  const width = Math.min(maxWidth, Math.max(...lines.map(measure)))
  return { width, height: lines.length * fontSize * LINE_HEIGHT, lineCount: lines.length }
}

// --- bubble sizing ----------------------------------------------------------
// How much of the bubble box its text actually occupies, mirroring
// bubbleTextRect() in bubbles.ts. `tail` is the extra vertical fraction the
// tail/point eats below the body. We INVERT these to grow the outer box from a
// measured text block.
function textAreaFraction(kind: BubbleKind): { fx: number; fy: number; tail: number; padded: boolean } {
  switch (kind) {
    case 'shout':
    case 'angry':
    case 'evil_laugh':
    case 'battle':
      return { fx: 0.56, fy: 0.46, tail: 0, padded: false }
    case 'scream':
    case 'explosive':
    case 'panic':
    case 'demon':
      return { fx: 0.52, fy: 0.42, tail: 0, padded: false }
    case 'thought':
    case 'sleep_talking':
      return { fx: 0.68, fy: 0.7, tail: 0.22, padded: false }
    case 'narration':
    case 'flashback':
    case 'announcement':
      return { fx: 0, fy: 0, tail: 0, padded: true }
    default:
      return { fx: 0, fy: 0, tail: 0.16, padded: true }
  }
}

/**
 * Build a bubble spec sized to `text`: readable font relative to the panel, text
 * wrapped to a sane column, and the outline box grown to fit (plus tail room),
 * clamped so it never gets absurdly wide or thin. Colours/font come from the
 * kind's preset via makeBubbleSpec.
 */
export function sizeBubbleToText(kind: BubbleKind, text: string, panelWidth: number): BubbleSpec {
  const base = makeBubbleSpec(kind, Math.round(panelWidth * 0.5))
  const fontSize = clamp(Math.round(panelWidth * 0.038), 20, 40)
  const maxTextWidth = panelWidth * 0.52
  const w = wrapText(text || base.text, maxTextWidth, fontSize, base.fontFamily, base.fontStyle)
  const textW = Math.max(w.width, fontSize * 2)
  const textH = w.height

  const { fx, fy, tail, padded } = textAreaFraction(kind)
  let boxW: number
  let boxH: number
  if (padded) {
    const pad = clamp(textW * 0.14, 14, 30)
    boxW = textW + 2 * pad
    boxH = (textH + 2 * pad) / (1 - tail)
  } else {
    boxW = textW / fx
    boxH = (textH / fy) / (1 - tail)
  }

  const width = Math.round(clamp(boxW, panelWidth * 0.22, panelWidth * 0.86))
  const height = Math.round(Math.max(boxH, fontSize * 2.2))
  return {
    ...base,
    text: (text || base.text).trim(),
    width,
    height,
    fontSize,
    strokeWidth: Math.max(2, Math.round(width * 0.014)),
  }
}

// --- SFX sizing -------------------------------------------------------------
// A borderless bold onomatopoeia caption. Big by default; the font shrinks to
// keep the whole word on one line inside the panel (never clipped to "GAHHK…").
// Layer name ends in this suffix so panelArt's TEXT projection can tell it from
// ordinary text (kept identical to panelArt.SFX_NAME_SUFFIX).
export const SFX_NAME_SUFFIX = ' sfx'

export interface SfxSpec {
  type: 'text'
  text: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontStyle: string
  fill: string
  align: 'center'
  name: string
}

export function sizeSfxToText(text: string, panelWidth: number): SfxSpec {
  const word = (text || '').trim()
  const maxWidth = panelWidth * 0.82
  let fontSize = Math.round(panelWidth * 0.11)
  const measured = wrapText(word, Number.MAX_SAFE_INTEGER, fontSize, 'Inter', 'bold').width
  if (measured > maxWidth) fontSize = Math.max(28, Math.round(fontSize * (maxWidth / measured)))
  const finalWidth = wrapText(word, Number.MAX_SAFE_INTEGER, fontSize, 'Inter', 'bold').width
  const width = Math.round(Math.min(maxWidth, finalWidth * 1.08 + fontSize * 0.6))
  return {
    type: 'text',
    text: word,
    width,
    height: Math.round(fontSize * 1.3),
    fontSize,
    fontFamily: 'Inter',
    fontStyle: 'bold',
    fill: '#111111',
    align: 'center',
    name: `${word}${SFX_NAME_SUFFIX}`,
  }
}

// --- the layout pass --------------------------------------------------------
export interface DialogueBubble {
  kind: BubbleKind
  text: string
  /** Storyboard placement zone (top-left … bottom-right), if the model gave one. */
  zone?: string
}

export interface PlacedBubble {
  type: 'bubble'
  spec: BubbleSpec
  x: number
  y: number
}
export interface PlacedSfx {
  type: 'sfx'
  spec: SfxSpec
  x: number
  y: number
}
export type PlacedItem = PlacedBubble | PlacedSfx

interface FlowItem {
  w: number
  h: number
  cx: number // desired horizontal center (px)
  desiredCy: number // desired vertical center (px)
  place: (x: number, y: number, scale: number) => PlacedItem
}

/**
 * Lay a panel's bubbles + SFX out with zero overlap. Each element is sized to its
 * text, seeded to its storyboard zone, then swept top-to-bottom: an item can
 * never start above the previous item's bottom + gap, which guarantees clean
 * vertical separation regardless of horizontal position. If the stack is taller
 * than the panel it's scaled down proportionally so it still fits.
 */
export function layoutPanelDialogue(
  page: { width: number; height: number },
  bubbles: DialogueBubble[],
  sfx: string[] = [],
): PlacedItem[] {
  const W = page.width
  const H = page.height
  const margin = Math.round(W * 0.05)
  const gap = Math.max(16, Math.round(H * 0.02))

  const items: FlowItem[] = []

  const nB = bubbles.length || 1
  bubbles.forEach((b, i) => {
    const spec = sizeBubbleToText(b.kind, b.text, W)
    const zone = b.zone ? ZONE[b.zone] : undefined
    const xFrac = zone ? zone.x : 0.5
    const yFrac = zone ? zone.y : 0.16 + (0.68 * (i + 0.5)) / nB
    items.push({
      w: spec.width,
      h: spec.height,
      cx: xFrac * W,
      desiredCy: yFrac * H,
      place: (x, y, scale) => ({
        type: 'bubble',
        x: Math.round(x),
        y: Math.round(y),
        spec:
          scale === 1
            ? spec
            : {
                ...spec,
                width: Math.round(spec.width * scale),
                height: Math.round(spec.height * scale),
                fontSize: Math.max(11, Math.round(spec.fontSize * scale)),
              },
      }),
    })
  })

  sfx.forEach((s, i) => {
    const spec = sizeSfxToText(s, W)
    items.push({
      w: spec.width,
      h: spec.height,
      cx: 0.5 * W,
      desiredCy: (0.3 + 0.2 * i) * H,
      place: (x, y, scale) => ({
        type: 'sfx',
        x: Math.round(x),
        y: Math.round(y),
        spec:
          scale === 1
            ? spec
            : {
                ...spec,
                width: Math.round(spec.width * scale),
                height: Math.round(spec.height * scale),
                fontSize: Math.max(14, Math.round(spec.fontSize * scale)),
              },
      }),
    })
  })

  if (items.length === 0) return []

  // Reading order = top-to-bottom by the seeded desired center.
  items.sort((a, b) => a.desiredCy - b.desiredCy)

  // Scale the whole stack down if it can't fit the panel's safe height.
  const available = H - 2 * margin
  const stackH = items.reduce((s, it) => s + it.h, 0) + gap * (items.length - 1)
  const scale = stackH > available ? Math.max(0.55, (available - gap * (items.length - 1)) / (stackH - gap * (items.length - 1))) : 1

  const placed: PlacedItem[] = []
  let cursor = margin
  for (const it of items) {
    const w = it.w * scale
    const h = it.h * scale
    const top = Math.max(cursor, clamp(it.desiredCy - h / 2, margin, H - margin - h))
    const left = clamp(it.cx - w / 2, margin, W - margin - w)
    placed.push(it.place(left, top, scale))
    cursor = top + h + gap
  }
  return placed
}
