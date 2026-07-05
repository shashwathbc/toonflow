import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { chargeTokens } from '@/lib/tokens'
import { verifiedUid } from '@/lib/auth/serverUser'

export const runtime = 'nodejs'
// Full-chapter generation streams for minutes — extend the serverless timeout
export const maxDuration = 300

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface PreviousChapterContext {
  chapterNumber: number
  title: string
  status: 'draft' | 'published'
  excerpt: string
}

export interface AIRequestBody {
  message: string
  novelTitle: string
  novelSynopsis: string
  novelGenres?: string[]
  novelTags?: string[]
  chapterTitle: string
  chapterContent: string
  previousChapters?: PreviousChapterContext[]
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userId?: string
  mode?: 'chat' | 'write-chapter'
}

const SYSTEM_PROMPT = `You are an expert AI Story Assistant for novelists using Toonflow Studio Paint. You help writers craft compelling stories, develop characters, build worlds, and improve their prose.

You have access to the current novel's context (title, synopsis, genres, tags), excerpts of every previous chapter, and the active chapter being written. Maintain full continuity with previous chapters: never contradict established events, revive dead characters, change personalities, or reset character emotions and relationships.

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
- When writing prose, match the author's existing style
- IMPORTANT: chapters on this platform are capped at 300 words total — when continuing or writing chapter content, never push a chapter past 300 words, and warn the writer if the current draft already exceeds it`

const WRITE_CHAPTER_PROMPT = `You are an award-winning webtoon writer.

Write ONE complete chapter.

Rules:
- Maximum 300 words. This is a HARD LIMIT — count them.
- Show, don't tell.
- Every line must either: build emotion, reveal character, progress the story, or increase tension.
- No unnecessary exposition.
- Every chapter must end with curiosity, suspense, or emotional impact.

Emotions must be shown through actions, expressions, body language, environment, silence, internal thoughts, and dialogue. Never explain emotions directly.

Instead of: "He was sad."
Write: "His hands trembled as he folded the last photograph."

Every chapter should feel cinematic. The reading experience should create emotional highs and lows every 40–60 words.

Structure:
Opening Hook → Character Emotion → Conflict → Escalation → Mini Twist → Cliffhanger

CONTINUITY — study the novel context and every previous chapter provided. Never contradict established events, revive dead characters, change personalities, or reset emotions — characters remember losses, victories, trauma, promises, and fears. Honor every decision made in the writer's conversation with the assistant.

OUTPUT FORMAT — STRICT:
- Return ONLY the chapter body as HTML: a sequence of <p>…</p> paragraphs
- Short paragraphs — each beat on its own line for vertical-scroll impact
- No markdown, no code fences, no <html>/<body> wrapper, no headings, no title, no commentary before or after
- Maximum 300 words total`

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body: AIRequestBody = await request.json()
    const {
      message,
      novelTitle,
      novelSynopsis,
      novelGenres,
      novelTags,
      chapterTitle,
      chapterContent,
      previousChapters,
      history,
      mode = 'chat',
    } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Charge tokens against the VERIFIED user — never a client-supplied id
    const charge = await chargeTokens(uid, 'novel-assist', `AI story assistant for "${novelTitle}"`)
    if (!charge.ok) {
      return NextResponse.json(
        { error: `Insufficient tokens. You need ${charge.required} tokens but have ${charge.balance}. Buy more tokens in your Wallet.`, insufficientTokens: true },
        { status: 402 }
      )
    }

    // Previous chapters power the consistency engine — cap total size to protect the context window
    const previousChaptersBlock = (previousChapters ?? [])
      .slice(-12)
      .map(
        (c) =>
          `CHAPTER ${c.chapterNumber} — "${c.title}" [${c.status}]\n${c.excerpt ? c.excerpt.slice(0, 3000) : '(no content)'}`
      )
      .join('\n\n')

    const contextBlock = [
      `NOVEL: "${novelTitle}"`,
      novelSynopsis ? `SYNOPSIS: ${novelSynopsis}` : '',
      novelGenres?.length ? `GENRES: ${novelGenres.join(', ')}` : '',
      novelTags?.length ? `TAGS: ${novelTags.join(', ')}` : '',
      previousChaptersBlock
        ? `--- PREVIOUS CHAPTERS (maintain full continuity with these) ---\n${previousChaptersBlock}\n--- END PREVIOUS CHAPTERS ---`
        : '',
      chapterTitle ? `CURRENT CHAPTER: "${chapterTitle}"` : '',
      chapterContent
        ? `CURRENT CHAPTER DRAFT (last 1000 chars): ...${chapterContent.slice(-1000)}`
        : 'CURRENT CHAPTER DRAFT: (empty - just started)',
    ]
      .filter(Boolean)
      .join('\n')

    if (mode === 'write-chapter') {
      // Full-chapter generation: long output, so stream server-side to avoid HTTP timeouts
      const systemWithContext = `${WRITE_CHAPTER_PROMPT}\n\n--- CURRENT NOVEL CONTEXT ---\n${contextBlock}`
      const conversation = history
        .slice(-20)
        .map((m) => `${m.role === 'user' ? 'WRITER' : 'ASSISTANT'}: ${m.content}`)
        .join('\n\n')

      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        // Chapters are hard-capped at 300 words — 4000 tokens is ample and backstops runaway output
        max_tokens: 4000,
        system: systemWithContext,
        messages: [
          {
            role: 'user',
            content: `--- CONVERSATION WITH THE WRITER (honor all decisions made here) ---\n${conversation || '(no prior conversation — write from the novel context)'}\n\n--- TASK ---\n${message}`,
          },
        ],
      })
      const final = await stream.finalMessage()

      let html = final.content[0]?.type === 'text' ? final.content[0].text.trim() : ''
      // Strip accidental markdown fences and keep only the paragraph body
      html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim()
      if (!html.startsWith('<p>')) {
        // Model returned plain text — convert line blocks to paragraphs
        html = html
          .split(/\n{1,2}/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `<p>${l}</p>`)
          .join('')
      }

      return NextResponse.json({ html })
    }

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
