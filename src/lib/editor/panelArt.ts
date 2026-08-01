import { useEditorStore, type Page, type EditorElement } from '@/store/useEditorStore'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { FULLBLEED_STYLE } from '@/lib/editor/webtoonFormat'
import {
  formatPagePrompt,
  tagForLineKind,
  type LineKind,
  type PromptLine,
} from '@/lib/editor/promptFormat'

/**
 * Shared "paint a webtoon panel" logic used by BOTH the batch agent workflow
 * (useAgentWorkflow) and the per-page "regenerate this panel" edit in the right
 * sidebar. One source of truth for the manhwa look, art-layer detection, the
 * image request (with retry/backoff), and how art is placed behind the bubbles.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// Premium manhwa look appended to EVERY panel prompt so panels share one style.
// The full-bleed clause is what stops each panel reading as a separate framed
// page: the art must run to all four edges so consecutive panels fuse into one
// continuous vertical scroll (see FULLBLEED_STYLE / webtoonFormat.ts).
export const MANHWA_STYLE =
  ', korean manhwa webtoon panel, official webtoon art style, clean sharp digital lineart,' +
  ' cel shading, screentone, vibrant colors, cinematic dramatic lighting,' +
  FULLBLEED_STYLE +
  ' professional studio quality, highly detailed'

// A painted panel background is a locked, full-page image layer whose name ends
// with this suffix. Used to find/replace a panel's art and to tell blanks apart.
export const ART_NAME_SUFFIX = ' art'

/** True when this page already has a painted background layer. */
export function pageHasArt(page: Page): boolean {
  return page.elements.some((e) => e.type === 'image' && e.isLocked && e.name.endsWith(ART_NAME_SUFFIX))
}

/** Sleep `ms` in 500ms slices so cancellation is honoured quickly. */
export async function sleepCancellable(ms: number, isCancelled: () => boolean = () => false) {
  for (let waited = 0; waited < ms; waited += 500) {
    if (isCancelled()) return
    await new Promise((r) => setTimeout(r, Math.min(500, ms - waited)))
  }
}

export type PanelImageResult =
  | { ok: true; base64: string; mime: string }
  | { ok: false; status?: number; error: string; rateLimited: boolean }

/**
 * Generate one panel image via /api/ai/generate-image. Up to 3 attempts: a 429
 * (upstream throttle) is backed off (3s, 6s) and retried rather than dropped; a
 * transient network/timeout error gets retried too. `isCancelled` lets a long
 * batch bail between attempts.
 */
export async function generatePanelImage(
  prompt: string,
  isCancelled: () => boolean = () => false,
  opts: { shot?: string; seed?: number } = {},
): Promise<PanelImageResult> {
  const MAX_ATTEMPTS = 4
  let error = 'the image service returned no image'
  let status: number | undefined
  let rateLimited = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (isCancelled()) return { ok: false, error: 'cancelled', rateLimited }
    const ctrl = new AbortController()
    // Slightly above the server's 80s abort so its error response can return.
    const timer = setTimeout(() => ctrl.abort(), 95_000)
    try {
      const ires = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          action: 'generate',
          prompt: prompt + MANHWA_STYLE,
          imageType: 'webtoon',
          shot: opts.shot,
          seed: opts.seed,
        }),
        signal: ctrl.signal,
      })
      if (isCancelled()) return { ok: false, error: 'cancelled', rateLimited }
      const idata = (await ires.json()) as { imageBase64?: string; imageMime?: string; error?: string; retryAfterMs?: number }
      if (ires.ok && idata.imageBase64) {
        return { ok: true, base64: idata.imageBase64, mime: idata.imageMime ?? 'image/jpeg' }
      }
      status = ires.status
      error = `HTTP ${ires.status}${idata.error ? ` — ${idata.error}` : ''}`
      if (ires.status === 429) {
        rateLimited = true
        if (attempt < MAX_ATTEMPTS - 1) {
          // The keyless Pollinations tier allows only ~1 request/15s, so a short
          // backoff just 429s again. Wait the server-provided Retry-After if we
          // got one, else at least the 15s window (escalating a little each try).
          const serverWait = typeof idata.retryAfterMs === 'number' && idata.retryAfterMs > 0 ? idata.retryAfterMs : 0
          await sleepCancellable(Math.max(serverWait, 15_000 + attempt * 5_000), isCancelled)
          continue
        }
        return { ok: false, status, error, rateLimited }
      }
    } catch (e) {
      if (isCancelled()) return { ok: false, error: 'cancelled', rateLimited }
      error = e instanceof Error ? `${e.name}: ${e.message}` : 'network error'
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, status, error, rateLimited }
}

/**
 * Put `url` on the page as its background art: if the page already has an art
 * layer, swap that layer's `src` in place (keeping its z-order + locked state);
 * otherwise add a new full-page locked image and send it behind the bubbles.
 * Returns false only if the page no longer exists.
 */
export function placePanelArt(pageId: string, url: string): boolean {
  const store = useEditorStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page) return false
  const existing = page.elements.find(
    (e) => e.type === 'image' && e.isLocked && e.name.endsWith(ART_NAME_SUFFIX),
  )
  if (existing) {
    store.updateElement(pageId, existing.id, { src: url }, true)
    return true
  }
  const imgId = store.addElement(pageId, {
    type: 'image',
    src: url,
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
    name: `Panel${ART_NAME_SUFFIX}`,
    isLocked: true,
  })
  store.moveZ(pageId, imgId, 'back')
  return true
}

/**
 * Regenerate ONE panel's art from an (edited) prompt and swap it in behind the
 * bubbles, then persist the prompt on the page. The bubbles and any manual edits
 * on top are untouched. Used by the per-page "regenerate this panel" control.
 */
export async function regeneratePanelArt(
  pageId: string,
  prompt: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Reuse the panel's own shot (aspect) and the chapter seed so a regenerated
  // panel still matches the rest of the strip's size and look.
  const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
  const res = await generatePanelImage(prompt, undefined, { shot: page?.artShot, seed: page?.artSeed })
  if (!res.ok) return { ok: false, error: res.error }
  try {
    const url = await uploadCanvasImage(`data:${res.mime};base64,${res.base64}`, `panel-${pageId}`)
    if (!placePanelArt(pageId, url)) return { ok: false, error: 'this panel no longer exists' }
    // Persist the edited prompt so it re-paints/edits from here next time.
    useEditorStore.getState().updatePage(pageId, { artPrompt: prompt }, false)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'upload/place failed' }
  }
}

// ---------------------------------------------------------------------------
// Canonical PROMPT / TEXT block ⇄ page glue.
//
// A page's editable prompt is the two-block format in promptFormat.ts: the
// art-only PROMPT (persisted as page.artPrompt) plus a TEXT block projected LIVE
// from the page's own dialogue — its speech bubbles and its SFX captions. Editing
// the TEXT block and regenerating rewrites those elements in place (see
// applyPromptLinesToPage), so the block is a real editing surface, not a copy
// that can drift from the canvas.
// ---------------------------------------------------------------------------

/**
 * A sound-effect caption is a borderless bold text element (onomatopoeia isn't a
 * speech bubble). Its layer name ends with this suffix so the TEXT projection can
 * tell an SFX caption apart from ordinary text placed on the page.
 */
export const SFX_NAME_SUFFIX = ' sfx'

/** True when this text element is an agent/creator SFX caption. */
function isSfxText(el: EditorElement): boolean {
  return el.type === 'text' && el.name.endsWith(SFX_NAME_SUFFIX)
}

/**
 * Spec for an onomatopoeia caption centred on (cx, cy). Shared by the agent
 * workflow and the per-page TEXT editor so `[SFX]` lines look the same however
 * they're added.
 */
export function makeSfxTextSpec(text: string, page: Page, cx: number, cy: number) {
  const fontSize = Math.max(24, Math.round(page.width * 0.11))
  const width = Math.round(page.width * 0.6)
  const height = Math.round(fontSize * 1.4)
  return {
    type: 'text' as const,
    text: text.trim(),
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width,
    height,
    fontSize,
    fontFamily: 'Inter',
    fontStyle: 'bold',
    fill: '#111111',
    align: 'center' as const,
    name: `${text.trim()}${SFX_NAME_SUFFIX}`,
  }
}

/** The page's dialogue elements (bubbles + SFX captions) in reading order. */
function dialogueElements(page: Page): EditorElement[] {
  return page.elements
    .filter((e) => e.type === 'bubble' || isSfxText(e))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Project a page's dialogue into TEXT-block rows, top-to-bottom. */
export function pageToPromptLines(page: Page): PromptLine[] {
  return dialogueElements(page).map((el) => {
    const kind: LineKind = el.type === 'bubble' ? el.bubbleType : 'sfx'
    const text = el.type === 'bubble' ? el.text : el.type === 'text' ? el.text : ''
    return { kind, tag: tagForLineKind(kind), text }
  })
}

/** The full canonical PROMPT / TEXT block a creator sees and edits for a page. */
export function buildPagePromptBlock(page: Page): string {
  return formatPagePrompt(page.artPrompt ?? '', pageToPromptLines(page))
}

/**
 * Apply edited TEXT-block rows back onto a page, non-destructively: match rows to
 * the existing dialogue elements top-to-bottom and rewrite their words; add a new
 * bubble / SFX caption for any extra rows. Existing bubbles keep their emotion
 * style, position and any manual moves — only the text changes. Leftover elements
 * beyond the row count are left untouched.
 */
export function applyPromptLinesToPage(pageId: string, lines: PromptLine[]): void {
  const store = useEditorStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page) return
  const existing = dialogueElements(page)

  // One undo step for pure text rewrites; adds carry their own history push.
  const rewrites = lines.slice(0, existing.length)
  const willRewrite = rewrites.some((line, i) => {
    const el = existing[i]
    const cur = el.type === 'bubble' || el.type === 'text' ? el.text : ''
    return line.text.trim() !== cur
  })
  if (willRewrite) store.pushHistory()

  rewrites.forEach((line, i) => {
    const el = existing[i]
    const cur = el.type === 'bubble' || el.type === 'text' ? el.text : ''
    if (line.text.trim() !== cur) store.updateElement(pageId, el.id, { text: line.text.trim() }, false)
  })

  // Extra rows → new elements, staggered down the page's negative space.
  const extras = lines.slice(existing.length)
  extras.forEach((line, i) => {
    const yFrac = Math.min(0.86, 0.2 + 0.14 * (existing.length + i))
    const cx = page.width * 0.5
    const cy = page.height * yFrac
    if (line.kind === 'sfx') {
      useEditorStore.getState().addElement(pageId, makeSfxTextSpec(line.text, page, cx, cy))
    } else {
      const id = useEditorStore.getState().addBubble(pageId, line.kind, cx, cy)
      if (id) useEditorStore.getState().updateElement(pageId, id, { text: line.text.trim() }, false)
    }
  })
}
