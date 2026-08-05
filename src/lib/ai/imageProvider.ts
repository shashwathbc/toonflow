// Image-generation provider abstraction (audit finding H1).
//
// The route (`/api/ai/generate-image`) calls `generateImageBytes` and stays
// provider-agnostic. Swapping the current key-authenticated Pollinations/Flux
// backend for a managed, SLA-backed, reference-conditioning-capable provider (the real H1/H4
// fix — img2img / IP-Adapter for character consistency) is then a change
// confined to THIS file: add a provider function and select it with the
// IMAGE_PROVIDER env var. The route, its error handling, and the client contract
// do not change.

export interface ImageRequest {
  /** Final, fully-styled prompt (the route shapes it before calling). */
  prompt: string
  width: number
  height: number
  seed: number
  /** Optional reference image (data URL / URL) for consistency-capable providers.
   *  Pollinations ignores it; a managed provider uses it for img2img/IP-Adapter. */
  referenceImage?: string
  timeoutMs?: number
}

export type ImageResult =
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; kind: 'rate_limited'; retryAfterMs?: number }
  | { ok: false; kind: 'bad_prompt' } // upstream returned a non-image (usually an unrenderable prompt)
  | { ok: false; kind: 'timeout' }
  | { ok: false; kind: 'no_credits' } // provider auth/billing config issue: missing/invalid key or no balance — not the prompt
  | { ok: false; kind: 'unavailable' }

const DEFAULT_TIMEOUT_MS = 80_000

/** Pollinations (Flux) on the gen.pollinations.ai API — requires a funded
 *  server-side secret key (POLLINATIONS_API_KEY, `sk_…`). */
async function pollinations(req: ImageRequest): Promise<ImageResult> {
  // gen.pollinations.ai requires an API key on every generation. Prefer the new
  // POLLINATIONS_API_KEY; fall back to the legacy POLLINATIONS_TOKEN name so an
  // already-configured deployment keeps working without a rename.
  const key = process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_TOKEN

  const params = new URLSearchParams({
    width: String(req.width),
    height: String(req.height),
    model: 'flux',
    nologo: 'true',
    seed: String(req.seed),
  })

  // Current image API. The old keyless `image.pollinations.ai/prompt/…` host is
  // retired — its models now 402 without a funded key. Attribution is carried by
  // the API key, so the old `referrer` param is gone.
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(req.prompt)}?${params.toString()}`
  const headers: Record<string, string> = { Accept: 'image/*' }
  if (key) headers.Authorization = `Bearer ${key}`
  else console.error('[imageProvider:pollinations] POLLINATIONS_API_KEY is not set — generation will 401')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, headers })

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'))
        const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
        return { ok: false, kind: 'rate_limited', retryAfterMs }
      }
      // 401 (missing/invalid key), 402 (insufficient pollen) and 403 (key lacks
      // permission) are all operator-side auth/billing config — NOT a bad prompt
      // or a transient outage. Surface them as `no_credits` so the operator fixes
      // the key/balance instead of chasing a phantom "service down". Body is small
      // (<1KB) and already consumed here for the log; the regex also catches a 402
      // wrapped inside a 500 JSON body (the legacy shape).
      const bodyText = await response.text().catch(() => '')
      if (
        response.status === 401 ||
        response.status === 402 ||
        response.status === 403 ||
        /PAYMENT_REQUIRED|Insufficient balance|\b402\b/i.test(bodyText)
      ) {
        console.error(
          `[imageProvider:pollinations] auth/billing error ${response.status} — check POLLINATIONS_API_KEY (valid + funded):`,
          bodyText.slice(0, 300),
        )
        return { ok: false, kind: 'no_credits' }
      }
      console.error('[imageProvider:pollinations] upstream error:', response.status, bodyText.slice(0, 300))
      return { ok: false, kind: 'unavailable' }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      console.error('[imageProvider:pollinations] non-image response:', contentType)
      return { ok: false, kind: 'bad_prompt' }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength === 0) return { ok: false, kind: 'unavailable' }

    return { ok: true, buffer, contentType }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error('[imageProvider:pollinations] fetch failed:', err)
    return { ok: false, kind: aborted ? 'timeout' : 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

/** Cloudflare Workers AI — a genuinely free daily tier (~10k "neurons"/day, no
 *  card). Defaults to SDXL because it honours width/height (covers 2:3, banners
 *  16:9, tall webtoon panels). FLUX.1-schnell is available via
 *  CLOUDFLARE_IMAGE_MODEL but only emits a fixed 1024² square, so it stays off by
 *  default. Requires a free Cloudflare account: CLOUDFLARE_ACCOUNT_ID + an
 *  AI-scoped CLOUDFLARE_API_TOKEN. */
async function cloudflare(req: ImageRequest): Promise<ImageResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/stabilityai/stable-diffusion-xl-base-1.0'

  if (!accountId || !token) {
    console.error('[imageProvider:cloudflare] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set')
    return { ok: false, kind: 'unavailable' }
  }

  // SDXL takes width/height (256–2048) + steps/seed and returns raw PNG bytes.
  // FLUX-schnell takes only prompt/steps (fixed square) and returns JSON with a
  // base64 image. Branch the request body; the response is handled by shape below.
  const isFlux = model.includes('flux')
  const clamp = (n: number) => Math.max(256, Math.min(2048, n)) // SDXL dimension bounds
  const body = isFlux
    ? { prompt: req.prompt, steps: 8 } // CF caps FLUX-schnell at 8 steps
    : {
        prompt: req.prompt,
        width: clamp(req.width),
        height: clamp(req.height),
        num_steps: 20, // CF caps SDXL at 20
        guidance: 7.5,
        seed: req.seed,
        negative_prompt: 'text, watermark, signature, logo, blurry, low quality, deformed',
      }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // 429 = the free daily neuron budget is spent (or too many requests) — a
      // transient, retry-later state, so pass any Retry-After through.
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'))
        const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
        return { ok: false, kind: 'rate_limited', retryAfterMs }
      }
      const bodyText = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        console.error('[imageProvider:cloudflare] auth error — check CLOUDFLARE_API_TOKEN (needs Workers AI):', bodyText.slice(0, 300))
        return { ok: false, kind: 'unavailable' }
      }
      console.error('[imageProvider:cloudflare] upstream error:', response.status, bodyText.slice(0, 300))
      return { ok: false, kind: 'unavailable' }
    }

    // FLUX-schnell → JSON { result: { image: <base64> } }; SDXL → raw image bytes.
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const json = (await response.json().catch(() => null)) as { result?: { image?: string } } | null
      const b64 = json?.result?.image
      if (!b64) {
        console.error('[imageProvider:cloudflare] JSON response missing result.image')
        return { ok: false, kind: 'unavailable' }
      }
      const buffer = Buffer.from(b64, 'base64')
      if (buffer.byteLength === 0) return { ok: false, kind: 'unavailable' }
      return { ok: true, buffer, contentType: 'image/jpeg' }
    }

    if (!contentType.startsWith('image/')) {
      const bodyText = await response.text().catch(() => '')
      console.error('[imageProvider:cloudflare] unexpected content-type:', contentType, bodyText.slice(0, 200))
      return { ok: false, kind: 'unavailable' }
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength === 0) return { ok: false, kind: 'unavailable' }
    return { ok: true, buffer, contentType }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error('[imageProvider:cloudflare] fetch failed:', err)
    return { ok: false, kind: aborted ? 'timeout' : 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

const PROVIDERS: Record<string, (req: ImageRequest) => Promise<ImageResult>> = {
  pollinations,
  cloudflare,
}

export function imageProviderName(): string {
  return process.env.IMAGE_PROVIDER || 'pollinations'
}

/** Generate image bytes with the configured provider. Never throws. */
export async function generateImageBytes(req: ImageRequest): Promise<ImageResult> {
  const provider = PROVIDERS[imageProviderName()] ?? pollinations
  return provider(req)
}
