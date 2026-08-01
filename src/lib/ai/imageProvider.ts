// Image-generation provider abstraction (audit finding H1).
//
// The route (`/api/ai/generate-image`) calls `generateImageBytes` and stays
// provider-agnostic. Swapping the current keyless Pollinations/Flux backend for
// a managed, SLA-backed, reference-conditioning-capable provider (the real H1/H4
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
  | { ok: false; kind: 'unavailable' }

const DEFAULT_TIMEOUT_MS = 80_000

/** Pollinations (Flux) — keyless anonymous tier, optional token for higher rate. */
async function pollinations(req: ImageRequest): Promise<ImageResult> {
  const token = process.env.POLLINATIONS_TOKEN
  const referrer = process.env.POLLINATIONS_REFERRER

  const params = new URLSearchParams({
    width: String(req.width),
    height: String(req.height),
    model: 'flux',
    nologo: 'true',
    seed: String(req.seed),
  })
  if (referrer) params.set('referrer', referrer)

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.prompt)}?${params.toString()}`
  const headers: Record<string, string> = { Accept: 'image/*' }
  if (token) headers.Authorization = `Bearer ${token}`

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
      console.error('[imageProvider:pollinations] upstream error:', response.status)
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

const PROVIDERS: Record<string, (req: ImageRequest) => Promise<ImageResult>> = {
  pollinations,
}

export function imageProviderName(): string {
  return process.env.IMAGE_PROVIDER || 'pollinations'
}

/** Generate image bytes with the configured provider. Never throws. */
export async function generateImageBytes(req: ImageRequest): Promise<ImageResult> {
  const provider = PROVIDERS[imageProviderName()] ?? pollinations
  return provider(req)
}
