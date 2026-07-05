import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chargeTokens } from '@/lib/tokens'
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

      // Charge 1 token for prompt generation (verified user only)
      const charge = await chargeTokens(uid, 'image-prompt', `AI image prompt for "${novelTitle}"`)
      if (!charge.ok) {
        return NextResponse.json(
          { error: `Insufficient tokens. You need ${charge.required} tokens but have ${charge.balance}. Buy more tokens in your Wallet.`, insufficientTokens: true },
          { status: 402 }
        )
      }

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

      // Charge 15 tokens for image generation (verified user only)
      const charge = await chargeTokens(uid, 'image-generate', `AI ${imageType} image generation`)
      if (!charge.ok) {
        return NextResponse.json(
          { error: `Insufficient tokens. You need ${charge.required} tokens but have ${charge.balance}. Buy more tokens in your Wallet.`, insufficientTokens: true },
          { status: 402 }
        )
      }

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
        const message =
          (errData as { errors?: string[] }).errors?.[0] ?? `Stability AI error ${response.status}`
        console.error('[/api/ai/generate-image] Stability AI error:', message)
        return NextResponse.json({ error: message }, { status: response.status })
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
