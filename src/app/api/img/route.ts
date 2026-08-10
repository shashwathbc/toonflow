import { isStorageUrl } from '@/lib/utils/imageProxy'

// Same-origin image proxy for Firebase Storage art. Server-side fetches have no
// CORS restriction, so streaming the bytes back through our own origin yields an
// image the browser treats as same-origin — untainted for canvas export/download
// and immune to the stale pre-CORS cache.
//
// SECURITY. A proxy that echoes a remote body out of our own origin is an XSS
// primitive unless three things all hold, so all three are enforced below:
//   1. TARGET  — only objects in a bucket we own (isStorageUrl is bucket-scoped;
//      the previous host-suffix check accepted any public GCS/Firebase bucket,
//      i.e. anybody's). Redirects are NOT followed, so an allowed host can't
//      bounce us to an internal address or an attacker origin (SSRF).
//   2. TYPE    — the response Content-Type is re-derived from our own raster
//      allowlist and never copied from upstream, so nothing can come back out of
//      this origin labelled text/html or image/svg+xml (both script-bearing).
//   3. CONTEXT — nosniff + a `default-src 'none'; sandbox` CSP on the response,
//      so even a mislabelled body is inert if a browser ever second-guesses us.
// Size and time ceilings keep a large or slow object from pinning a worker.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Raster types we are willing to re-serve. Deliberately excludes image/svg+xml,
 *  which is a script-execution context in a top-level navigation. */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
])

/** Matches the 25 MB episode-panel ceiling in storage.rules, plus headroom. */
const MAX_BYTES = 30 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 15_000

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u')
  if (!u) return new Response('Missing "u" parameter', { status: 400 })
  if (!isStorageUrl(u)) return new Response('Host not allowed', { status: 403 })

  let upstream: Response
  try {
    upstream = await fetch(u, {
      cache: 'no-store',
      // Do not chase 3xx: a redirect is the standard way to turn an allowlisted
      // host into a request against an internal service or metadata endpoint.
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return new Response('Upstream fetch failed', { status: 502 })
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return new Response('Upstream redirect refused', { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', { status: upstream.status || 502 })
  }

  // Normalise `image/png; charset=utf-8` → `image/png` before the allowlist test.
  const rawType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(rawType)) {
    return new Response('Unsupported media type', { status: 415 })
  }

  const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    return new Response('Image too large', { status: 413 })
  }

  // Enforce the ceiling on the wire too — content-length is advisory and may be
  // absent on a chunked response.
  let seen = 0
  const capped = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength
        if (seen > MAX_BYTES) {
          controller.error(new Error('Image exceeded size limit'))
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )

  return new Response(capped, {
    status: 200,
    headers: {
      'Content-Type': rawType,
      // Cache the clean copy on the client; it's immutable content behind a token.
      'Cache-Control': 'public, max-age=3600, immutable',
      'Access-Control-Allow-Origin': '*',
      // Belt and braces: never let a browser sniff its way to a script context,
      // and strip this response of any ambient capability if it is navigated to.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    },
  })
}
