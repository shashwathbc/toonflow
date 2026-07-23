import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BODY_BYTES = 64 * 1024

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
      // Auth is still required above (verifiedUid).

      const isCover = imageType === 'cover'

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [
          {
            role: 'user',
            content: `Write a concise image generation prompt for a professional ${isCover ? 'book cover (2:3 portrait)' : 'banner image (16:9 landscape)'} for this novel:

Title: "${novelTitle}"
Synopsis: "${novelSynopsis || 'No synopsis provided'}"

Requirements:
- Dramatic, emotionally resonant composition
- Specific lighting, mood, color palette
- ${isCover ? 'Portrait orientation, foreground subject dominant' : 'Wide cinematic landscape, atmospheric'}
- No text, no typography, no letters in the image
- Genre-appropriate visual style
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

      // AI image generation is free for all users — no token charge.
      // Auth is still required above (verifiedUid).

      const apiKey = process.env.STABILITY_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              'Image generation requires STABILITY_API_KEY. Add it to .env.local (get a key at platform.stability.ai).',
            noKey: true,
          },
          { status: 503 }
        )
      }

      const aspectRatio = imageType === 'cover' ? '2:3' : '16:9'

      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('output_format', 'webp')
      formData.append('aspect_ratio', aspectRatio)

      const response = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/ultra',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const rawMessage =
          (errData as { errors?: string[] }).errors?.[0] ?? `HTTP ${response.status}`
        // Log the true upstream reason (incl. billing state) server-side only —
        // never forward the provider name or "buy credits" links to end users.
        console.error('[/api/ai/generate-image] Stability AI error:', response.status, rawMessage)

        const s = response.status
        let clientError: string
        let clientStatus: number
        if (s === 402 || /credit|quota|billing/i.test(rawMessage)) {
          // Provider credits exhausted — a transient outage from the user's view.
          clientError = 'AI image generation is temporarily unavailable. Please upload your own image for now, or try again later.'
          clientStatus = 503
        } else if (s === 429) {
          clientError = 'Too many image requests right now. Please wait a moment and try again.'
          clientStatus = 429
        } else if (s === 400 || s === 403) {
          clientError = "That description couldn't be turned into an image. Try rephrasing it and generate again."
          clientStatus = 422
        } else {
          clientError = 'Image service temporarily unavailable. Please try again later.'
          clientStatus = 502
        }
        return NextResponse.json({ error: clientError }, { status: clientStatus })
      }

      const data = (await response.json()) as { image: string }
      return NextResponse.json({ imageBase64: data.image })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[/api/ai/generate-image] Error:', err)
    return NextResponse.json({ error: 'Image service temporarily unavailable' }, { status: 502 })
  }
}
