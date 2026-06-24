import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Action = 'generate-synopsis' | 'improve-synopsis' | 'expand-synopsis'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action: Action
      novelTitle: string
      currentSynopsis?: string
      userPrompt?: string
    }

    const { action, novelTitle, currentSynopsis, userPrompt } = body

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
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
