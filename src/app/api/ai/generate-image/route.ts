import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { aiRateLimited } from '@/lib/api/aiRateLimit'

export const runtime = 'nodejs'
// Flux generation can take 20–40s; give the route room beyond the default.
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BODY_BYTES = 64 * 1024

// Platform signature look. Appended to EVERY Flux prompt — drafted by AI,
// auto-filled, or hand-typed by the user — so all covers/banners come out as
// the same premium cinematic Korean webtoon / manhwa poster art (see the
// Ravana / Karna / Shadow Island reference set), never generic stock imagery.
// Flux's URL API has no negative-prompt field, so the "no text/logo" guards are
// folded in here as positive phrasing (text is added later as a design overlay).
const WEBTOON_STYLE_SUFFIX =
  ', premium Korean webtoon manhwa cover art, cinematic dramatic lighting,' +
  ' highly detailed digital painting, epic atmospheric composition,' +
  ' rich moody cinematic color grading, bold heroic framing, clean professional' +
  ' illustration, sharp focus, ultra detailed, high quality,' +
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
- Describe only the SCENE, subject, lighting and mood — do NOT name an art medium or software (the webtoon art style is applied separately)
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

      // Force the platform's webtoon art look onto whatever prompt arrives,
      // whether AI-drafted, auto-filled, or typed by hand.
      const styledPrompt = `${prompt}${WEBTOON_STYLE_SUFFIX}`

      const seed = Math.floor(Math.random() * 1_000_000)
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}` +
        `?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`

      // Cap the wait so the request can't hang forever if the service stalls.
      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 55_000)
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'image/*' },
        })

        if (!response.ok) {
          console.error('[/api/ai/generate-image] Pollinations error:', response.status)
          if (response.status === 429) {
            return NextResponse.json(
              { error: 'Too many image requests right now. Please wait a moment and try again.' },
              { status: 429 }
            )
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
