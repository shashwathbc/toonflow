/**
 * Canonical page-prompt FORMAT — the single source of truth for the two-block
 * pattern every agent-built webtoon page carries and the creator edits:
 *
 *   PROMPT
 *   <full-bleed environment + any characters present + camera + cinematic style.
 *    Color: dominant …, secondary …, accent …>
 *
 *   TEXT
 *   [SFX] DONG. DONG. DONG.
 *   [NARRATION] A forgotten age had ended.
 *
 * The PROMPT block is what the image model paints (art only — never the words).
 * The TEXT block is the page's dialogue/narration/SFX as `[TAG] line` rows, where
 * TAG names the emotion so it round-trips 1:1 to a speech-bubble kind (or SFX to a
 * free onomatopoeia caption). Both the layout code and the right-sidebar editor go
 * through here so the pattern can never drift.
 *
 * Pure module: no React, no Konva, no store, no browser APIs — safe to import
 * from a route handler, the client painter, and the editor alike.
 */

import type { BubbleKind } from '@/lib/editor/bubbles'
import { BUBBLE_DEFS } from '@/lib/editor/bubbles'

/** A TEXT-block row is either a speech bubble (by emotion kind) or a sound effect. */
export type LineKind = BubbleKind | 'sfx'

export interface PromptLine {
  /** The bracketed label shown in the block, e.g. `NARRATION`, `SHOUT`, `SFX`. */
  tag: string
  text: string
  kind: LineKind
}

export interface ParsedPagePrompt {
  /** The art-only prompt (everything under PROMPT). */
  art: string
  /** The dialogue/narration/SFX rows (everything under TEXT). */
  lines: PromptLine[]
}

export const PROMPT_HEADER = 'PROMPT'
export const TEXT_HEADER = 'TEXT'
/** Special tag for onomatopoeia — rendered as a caption, not a bubble. */
export const SFX_TAG = 'SFX'

const VALID_KINDS = new Set<string>(BUBBLE_DEFS.map((b) => b.kind))

/**
 * Emotion kind → bracket tag. The tag is just the kind upper-cased, so it both
 * reads naturally (`[NARRATION]`, `[SHOUT]`, `[WHISPER]`) AND inverts losslessly
 * back to the exact bubble kind on parse. `sfx` gets the dedicated SFX tag.
 */
export function tagForLineKind(kind: LineKind): string {
  return kind === 'sfx' ? SFX_TAG : kind.toUpperCase()
}

/**
 * Bracket tag → line kind. `SFX` → the sound-effect caption; a tag that names a
 * real bubble kind resolves to it; anything else falls back to plain `speech`, so
 * a creator can type `[Bob]` and still get a normal dialogue bubble.
 */
export function kindForTag(tag: string): LineKind {
  const t = tag.trim().toLowerCase()
  if (t === 'sfx') return 'sfx'
  if (VALID_KINDS.has(t)) return t as BubbleKind
  return 'speech'
}

/** Build a `[TAG] text` row, coercing a raw kind into a stable tag. */
function formatLine(line: { kind: LineKind; text: string }): string {
  return `[${tagForLineKind(line.kind)}] ${line.text.trim()}`
}

/**
 * Render the canonical two-block prompt for a page. Both headers are always
 * emitted so the pattern is consistent and the TEXT area is ready to type into,
 * even on a silent, dialogue-free panel.
 */
export function formatPagePrompt(art: string, lines: { kind: LineKind; text: string }[]): string {
  const body = lines
    .filter((l) => l.text.trim())
    .map(formatLine)
    .join('\n')
  return `${PROMPT_HEADER}\n${art.trim()}\n\n${TEXT_HEADER}\n${body}`.trimEnd() + '\n'
}

// A row that starts with a `[TAG]`; the rest of the line is its text.
const TAGGED_ROW = /^\s*\[([^\]]+)\]\s*(.*)$/
const HEADER_RE = (h: string) => new RegExp(`^\\s*${h}\\s*:?\\s*$`, 'i')
const PROMPT_HEADER_RE = HEADER_RE(PROMPT_HEADER)
const TEXT_HEADER_RE = HEADER_RE(TEXT_HEADER)

/**
 * Parse an (edited) canonical block back into { art, lines }. Tolerant of missing
 * headers so hand-typed or legacy art-only prompts still work:
 *  - Text is split at the first standalone `TEXT` header line.
 *  - A leading `PROMPT` header line (if present) is dropped from the art.
 *  - With no `TEXT` header, the whole thing is treated as the art prompt.
 *  - A TEXT row without a `[TAG]` is treated as a plain speech line.
 */
export function parsePagePrompt(raw: string): ParsedPagePrompt {
  const allLines = raw.replace(/\r\n/g, '\n').split('\n')
  const textIdx = allLines.findIndex((l) => TEXT_HEADER_RE.test(l))

  const artLines = (textIdx >= 0 ? allLines.slice(0, textIdx) : allLines).filter(
    (l, i) => !(i === 0 && PROMPT_HEADER_RE.test(l)),
  )
  // Also drop a PROMPT header that isn't the very first line (leading blank lines).
  const art = artLines
    .filter((l) => !PROMPT_HEADER_RE.test(l))
    .join('\n')
    .trim()

  const lines: PromptLine[] = []
  if (textIdx >= 0) {
    for (const rowRaw of allLines.slice(textIdx + 1)) {
      const row = rowRaw.trim()
      if (!row) continue
      const m = row.match(TAGGED_ROW)
      if (m) {
        const tag = m[1].trim().toUpperCase()
        const text = m[2].trim()
        if (!text) continue
        lines.push({ tag, text, kind: kindForTag(tag) })
      } else {
        lines.push({ tag: 'SPEECH', text: row, kind: 'speech' })
      }
    }
  }
  return { art, lines }
}
