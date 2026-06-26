import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface AIRequestBody {
  message: string
  novelTitle: string
  novelSynopsis: string
  chapterTitle: string
  chapterContent: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

const SYSTEM_PROMPT = `You are an expert AI Story Assistant for novelists using Toonflow Studio Paint. You help writers craft compelling stories, develop characters, build worlds, and improve their prose.

You have access to the current novel's context (title, synopsis) and the active chapter being written.

Your capabilities:
- Generate Story Ideas: Brainstorm plot directions, twists, and narrative arcs
- Character Creation: Develop detailed character profiles, backstories, motivations
- Universe Building: Create rich world details, lore, geography, magic systems
- Dialogue Generator: Write natural, character-specific dialogue
- Plot Expansion: Deepen plot points with subplots and complications
- Chapter Continuation: Write the next few paragraphs based on the current content
- Grammar Correction: Fix grammar, punctuation, and style issues
- Rewrite Chapter: Rewrite sections with improved prose and pacing
- Summarize Chapter: Create concise summaries of chapter content

Guidelines:
- Be creative, detailed, and context-aware
- Match the tone and genre of the current novel
- Keep responses focused and actionable
- Format long responses with clear sections
- When writing prose, match the author's existing style`

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('toonflow-auth-token')?.value
  if (!authToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body: AIRequestBody = await request.json()
    const { message, novelTitle, novelSynopsis, chapterTitle, chapterContent, history } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const contextBlock = [
      `NOVEL: "${novelTitle}"`,
      novelSynopsis ? `SYNOPSIS: ${novelSynopsis}` : '',
      chapterTitle ? `CURRENT CHAPTER: "${chapterTitle}"` : '',
      chapterContent
        ? `CHAPTER CONTENT (last 1000 chars): ...${chapterContent.slice(-1000)}`
        : 'CHAPTER CONTENT: (empty - just started)',
    ]
      .filter(Boolean)
      .join('\n')

    const systemWithContext = `${SYSTEM_PROMPT}\n\n--- CURRENT NOVEL CONTEXT ---\n${contextBlock}`

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemWithContext,
      messages,
    })

    const reply =
      response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('AI assist error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 500 })
    }
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 })
  }
}
