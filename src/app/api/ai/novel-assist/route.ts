import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chargeTokens } from '@/lib/tokens'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { SYSTEM_PROMPT, WRITE_CHAPTER_PROMPT } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
// Full-chapter generation streams for minutes — extend the serverless timeout
export const maxDuration = 300

// The context arrays are large by design; cap total body so a client can't
// force the server to buffer/forward megabytes to the model.
const MAX_BODY_BYTES = 512 * 1024

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  novelTitle: z.string().max(300).optional().default(''),
  novelSynopsis: z.string().max(6000).optional().default(''),
  novelGenres: z.array(z.string().max(40)).max(30).optional(),
  novelTags: z.array(z.string().max(40)).max(50).optional(),
  chapterTitle: z.string().max(300).optional().default(''),
  chapterContent: z.string().max(20000).optional().default(''),
  previousChapters: z.array(z.object({
    chapterNumber: z.number(),
    title: z.string().max(300),
    status: z.enum(['draft', 'published']),
    excerpt: z.string().max(5000),
  })).max(60).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(8000),
  })).max(40).optional().default([]),
  mode: z.enum(['chat', 'write-chapter']).optional().default('chat'),
})

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

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
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
      mode,
    } = parsed.data

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
    // Log full detail server-side; return a generic message so upstream API
    // internals (keys, model errors, org data) never reach the client.
    console.error('AI assist error:', error)
    const status = error instanceof Anthropic.APIError ? (error.status ?? 502) : 502
    return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status })
  }
}
