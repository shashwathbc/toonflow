import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { aiRateLimited } from '@/lib/api/aiRateLimit'

export const runtime = 'nodejs'
// Flux generation of long, UNIQUE prompts (e.g. the agent workflow's per-panel
// art-directed prompts) misses Pollinations' cache and can take 45–60s+; give
// the route generous room so those don't get killed mid-generation.
export const maxDuration = 90

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BODY_BYTES = 64 * 1024

// Premium look appended to EVERY Flux prompt — drafted by AI, auto-filled, or
// hand-typed — so covers/banners come out polished and cinematic, never generic
// stock imagery.
//
// IMPORTANT: this suffix describes only the RENDERING STYLE (lighting, colour,
// detail, quality) — never the SUBJECT, COMPOSITION, or ART MEDIUM.
//
// It deliberately does NOT say "Korean webtoon / manhwa cover art". Empirically
// (verified against the live Flux service), that exact phrase carries such a
// strong "beautiful character portrait" prior that it OVERRIDES the actual
// subject: typing "bow" produced a manhwa man's face, "a magic sword" produced a
// man holding a sword, etc. — the subject got ignored. Even a lightened
// "manhwa digital art style" still forced a person unless "no humans" was added,
// and "no humans" can't be hardcoded because most covers DO want a character.
//
// Neutral premium-illustration wording renders objects as objects AND still
// renders characters/scenes as characters (driven by the prompt content — the
// Auto-fill action and character prompts describe people, so they still get a
// person). The webtoon/manhwa flavour for character covers now lives in the
// Auto-fill prompt text itself (see the 'prompt' action below), not here.
//
// Flux's URL API has no negative-prompt field, so the "no text/logo" guards are
// folded in here as positive phrasing (text is added later as a design overlay).
const STYLE_SUFFIX =
  ', premium digital illustration, cinematic dramatic lighting,' +
  ' highly detailed, rich cinematic color grading, sharp focus,' +
  ' ultra detailed, high quality,' +
  ' no text, no typography, no letters, no watermark, no logo'

const promptSchema = z.object({
  action: z.literal('prompt'),
  novelTitle: z.string().max(300),
  novelSynopsis: z.string().max(4000).optional().default(''),
  imageType: z.enum(['cover', 'banner']),
})
const generateSchema = z.object({
  action: z.literal('generate'),
  prompt: z.string().min(1).max(2000),
  imageType: z.enum(['cover', 'banner']),
})

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required — please sign in again' }, { status: 401 })
  }

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[/api/ai/generate-image] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()

    if (body?.action === 'prompt') {
      const parsed = promptSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      const { novelTitle, novelSynopsis, imageType } = parsed.data

      // AI image prompt generation is free for all users — no token charge.
      // Auth (above) + a per-user hourly cap keep vendor spend bounded.
      const limited = aiRateLimited(uid, 'text')
      if (limited) return limited

      const isCover = imageType === 'cover'

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [
          {
            role: 'user',
            content: `Write a concise image generation prompt for a premium ${isCover ? 'webtoon cover (2:3 portrait)' : 'webtoon banner (16:9 landscape)'} for this novel:

Title: "${novelTitle}"
Synopsis: "${novelSynopsis || 'No synopsis provided'}"

Requirements:
- Cinematic Korean webtoon / manhwa cover art — dramatic and emotionally resonant
- A clear focal subject (the hero/character or an iconic scene) with a strong silhouette
- Specific dramatic lighting, mood, and a rich cinematic color palette
- ${isCover ? 'Portrait orientation, foreground subject dominant' : 'Wide cinematic landscape, atmospheric depth'}
- Explicitly render it in a premium Korean webtoon / manhwa cover illustration art style (name this style in the prompt — it is NOT added elsewhere)
- No text, no typography, no letters in the image
- 50–80 words maximum

Return ONLY the image prompt text.`,
          },
        ],
      })

      const prompt =
        response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
      return NextResponse.json({ prompt })
    }

    if (body?.action === 'generate') {
      const parsed = generateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      const { prompt, imageType } = parsed.data

      // AI image generation is free for all users. We use Pollinations (Flux) —
      // a keyless, no-billing image service — so there are no credits to run out
      // of. Auth (above) + a per-user hourly cap bound how fast one account can
      // hammer the upstream service.
      const limited = aiRateLimited(uid, 'image')
      if (limited) return limited

      // Flux-friendly dimensions (multiples of 64). Cover = 2:3 portrait,
      // banner = 16:9 landscape.
      const { width, height } =
        imageType === 'cover' ? { width: 768, height: 1152 } : { width: 1280, height: 720 }

      // For a SHORT subject ("bow"), repeat it up front and mark it as the main
      // subject so it stays dominant over the style descriptors instead of being
      // swamped and mis-rendered (verified against the live Flux service). But an
      // already-long, detailed prompt (the agent workflow's art-directed panel
      // prompts) needs NO doubling — repeating it only lengthens the URL and slows
      // generation, which pushed panels past the timeout and left them blank.
      const styledPrompt =
        prompt.length <= 120
          ? `${prompt}. ${prompt}, as the main subject of the image${STYLE_SUFFIX}`
          : `${prompt}${STYLE_SUFFIX}`

      const seed = Math.floor(Math.random() * 1_000_000)

      // Optional Pollinations auth. The keyless/anonymous tier is throttled to
      // ~1 image request every 15s, which a 20-panel chapter run trips
      // constantly (→ blank panels). Registering a free token at
      // https://auth.pollinations.ai lifts the account to the Seed tier
      // (1 req/5s) or higher; set POLLINATIONS_TOKEN (server env) to use it.
      // POLLINATIONS_REFERRER identifies the app for referrer-based tiering.
      const pollToken = process.env.POLLINATIONS_TOKEN
      const pollReferrer = process.env.POLLINATIONS_REFERRER
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        model: 'flux',
        nologo: 'true',
        seed: String(seed),
      })
      if (pollReferrer) params.set('referrer', pollReferrer)
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?${params.toString()}`
      const headers: Record<string, string> = { Accept: 'image/*' }
      if (pollToken) headers.Authorization = `Bearer ${pollToken}`

      // Cap the wait so the request can't hang forever if the service stalls.
      // Long unique prompts routinely take 45–60s, so allow up to 80s (still
      // inside maxDuration); the client aborts its own request a little after.
      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 80_000)
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        })

        if (!response.ok) {
          console.error('[/api/ai/generate-image] Pollinations error:', response.status)
          if (response.status === 429) {
            // Pass Pollinations' Retry-After through so the client can back off
            // for exactly the window it asks for instead of guessing.
            const retryAfter = Number(response.headers.get('retry-after'))
            const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
            const res = NextResponse.json(
              {
                error: 'Too many image requests right now. Please wait a moment and try again.',
                retryAfterMs,
              },
              { status: 429 }
            )
            if (retryAfterMs) res.headers.set('Retry-After', String(retryAfter))
            return res
          }
          return NextResponse.json(
            { error: 'AI image generation is busy right now. Please try again in a moment.' },
            { status: 502 }
          )
        }

        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.startsWith('image/')) {
          // Upstream returned an error/HTML page instead of an image.
          console.error('[/api/ai/generate-image] Pollinations returned non-image:', contentType)
          return NextResponse.json(
            {
              error:
                "That description couldn't be turned into an image. Try rephrasing it and generate again.",
            },
            { status: 422 }
          )
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.byteLength === 0) {
          return NextResponse.json(
            { error: 'AI image generation is busy right now. Please try again in a moment.' },
            { status: 502 }
          )
        }

        const imageBase64 = buffer.toString('base64')
        return NextResponse.json({ imageBase64, imageMime: contentType })
      } catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError'
        console.error('[/api/ai/generate-image] Pollinations fetch failed:', err)
        return NextResponse.json(
          {
            error: aborted
              ? 'Image generation is taking longer than usual. Please try again.'
              : 'AI image generation is temporarily unavailable. Please try again in a moment.',
          },
          { status: aborted ? 504 : 502 }
        )
      } finally {
        clearTimeout(abortTimer)
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[/api/ai/generate-image] Error:', err)
    return NextResponse.json({ error: 'Image service temporarily unavailable' }, { status: 502 })
  }
}
