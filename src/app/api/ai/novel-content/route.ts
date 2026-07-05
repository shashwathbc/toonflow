import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chargeTokens } from '@/lib/tokens'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Action = 'generate-synopsis' | 'improve-synopsis' | 'expand-synopsis'

const ACTION_TOKEN_MAP: Record<Action, 'synopsis-generate' | 'synopsis-improve' | 'synopsis-expand'> = {
  'generate-synopsis': 'synopsis-generate',
  'improve-synopsis': 'synopsis-improve',
  'expand-synopsis': 'synopsis-expand',
}

const MAX_BODY_BYTES = 64 * 1024

const bodySchema = z.object({
  action: z.enum(['generate-synopsis', 'improve-synopsis', 'expand-synopsis']),
  novelTitle: z.string().max(300),
  currentSynopsis: z.string().max(8000).optional(),
  userPrompt: z.string().max(2000).optional(),
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
    console.error('[/api/ai/novel-content] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 })
  }

  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { action, novelTitle, currentSynopsis, userPrompt } = parsed.data

    // Charge tokens against the VERIFIED user — never a client-supplied id
    const tokenAction = ACTION_TOKEN_MAP[action]
    const charge = await chargeTokens(uid, tokenAction, `AI ${action.replace(/-/g, ' ')} for "${novelTitle}"`)
    if (!charge.ok) {
      return NextResponse.json(
        { error: `Insufficient tokens. You need ${charge.required} tokens but have ${charge.balance}. Buy more tokens in your Wallet.`, insufficientTokens: true },
        { status: 402 }
      )
    }

    let userMessage = ''

    if (action === 'generate-synopsis') {
      userMessage = `Write a compelling synopsis for a novel titled "${novelTitle}".
${userPrompt ? `Additional context: ${userPrompt}` : ''}

Requirements:
- 3–5 sentences, vivid and engaging
- Hook the reader immediately
- Hint at conflict, stakes, and tone
- No spoilers for the ending
- Professional back-cover style

Return ONLY the synopsis text, no labels or quotes.`
    } else if (action === 'improve-synopsis') {
      userMessage = `Improve this novel synopsis for "${novelTitle}":

Current synopsis:
${currentSynopsis}

${userPrompt ? `Feedback/direction: ${userPrompt}` : 'Make it more engaging, vivid, and compelling.'}

Requirements:
- Keep roughly the same length
- Stronger opening hook
- Clearer stakes and conflict
- Professional back-cover style

Return ONLY the improved synopsis text.`
    } else if (action === 'expand-synopsis') {
      userMessage = `Expand this brief synopsis for "${novelTitle}" into a full 4–6 sentence back-cover description:

Current text:
${currentSynopsis}

Return ONLY the expanded synopsis text.`
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: userMessage }],
    })

    const result =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    return NextResponse.json({ result })
  } catch (err) {
    // Log details server-side; never echo raw error text (may leak internals).
    console.error('[/api/ai/novel-content] Error:', err)
    return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 })
  }
}
