import { useEditorStore, type Page } from '@/store/useEditorStore'
import { uploadCanvasImage } from '@/lib/editor/persistence'

/**
 * Shared "paint a webtoon panel" logic used by BOTH the batch agent workflow
 * (useAgentWorkflow) and the per-page "regenerate this panel" edit in the right
 * sidebar. One source of truth for the manhwa look, art-layer detection, the
 * image request (with retry/backoff), and how art is placed behind the bubbles.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// Premium manhwa look appended to EVERY panel prompt so panels share one style.
export const MANHWA_STYLE =
  ', korean manhwa webtoon panel, official webtoon art style, clean sharp digital lineart,' +
  ' cel shading, screentone, vibrant colors, cinematic dramatic lighting,' +
  ' dynamic vertical composition, professional studio quality, highly detailed'

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
        body: JSON.stringify({ action: 'generate', prompt: prompt + MANHWA_STYLE, imageType: 'cover' }),
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
  const res = await generatePanelImage(prompt)
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
