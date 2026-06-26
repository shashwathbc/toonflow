import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('toonflow-auth-token')?.value
  if (!authToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (body.action === 'prompt') {
      const { novelTitle, novelSynopsis, imageType } = body as {
        novelTitle: string
        novelSynopsis: string
        imageType: 'cover' | 'banner'
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

    if (body.action === 'generate') {
      const { prompt, imageType } = body as {
        prompt: string
        imageType: 'cover' | 'banner'
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
        return NextResponse.json({ error: message }, { status: response.status })
      }

      const data = (await response.json()) as { image: string }
      return NextResponse.json({ imageBase64: data.image })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
