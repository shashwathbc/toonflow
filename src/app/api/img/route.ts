import { isStorageUrl } from '@/lib/utils/imageProxy'

// Same-origin image proxy for Firebase Storage art. Server-side fetches have no
// CORS restriction, so streaming the bytes back through our own origin yields an
// image the browser treats as same-origin — untainted for canvas export/download
// and immune to the stale pre-CORS cache. The host allowlist (isStorageUrl)
// keeps this from becoming an open relay (SSRF guard).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u')
  if (!u) return new Response('Missing "u" parameter', { status: 400 })
  if (!isStorageUrl(u)) return new Response('Host not allowed', { status: 403 })

  let upstream: Response
  try {
    upstream = await fetch(u, { cache: 'no-store' })
  } catch {
    return new Response('Upstream fetch failed', { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', { status: upstream.status || 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache the clean copy on the client; it's immutable content behind a token.
      'Cache-Control': 'public, max-age=3600, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
