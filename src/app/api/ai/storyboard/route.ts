import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { aiRateLimited } from '@/lib/api/aiRateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BODY_BYTES = 32 * 1024
const MAX_PANELS = 20

// Bubble kinds the editor understands (see src/lib/editor/bubbles.ts).
const KINDS = ['speech', 'thought', 'shout', 'scream', 'whisper', 'narration', 'electronic'] as const

const schema = z.object({
  action: z.literal('storyboard').optional(),
  script: z.string().min(1).max(8000),
  title: z.string().max(300).optional(),
  synopsis: z.string().max(4000).optional(),
  panels: z.number().int().min(2).max(MAX_PANELS).optional(),
})

interface Bubble { kind: string; text: string }
interface Panel { scene: string; bubbles: Bubble[] }

function asString(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** Pull the JSON object out of the model reply, tolerating ``` fences / prose. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json object in reply')
  return JSON.parse(raw.slice(start, end + 1))
}

function normalizePanels(json: unknown): Panel[] {
  const obj = json && typeof json === 'object' ? (json as { panels?: unknown }) : {}
  const arr = Array.isArray(obj.panels) ? obj.panels : []
  const out: Panel[] = []
  for (const p of arr.slice(0, MAX_PANELS)) {
    const panel = p && typeof p === 'object' ? (p as { scene?: unknown; bubbles?: unknown }) : {}
    const scene = asString(panel.scene, 600).trim()
    if (!scene) continue
    const bubblesArr = Array.isArray(panel.bubbles) ? panel.bubbles : []
    const bubbles: Bubble[] = []
    for (const b of bubblesArr.slice(0, 4)) {
      const rb = b && typeof b === 'object' ? (b as { kind?: unknown; text?: unknown }) : {}
      const text = asString(rb.text, 240).trim()
      if (!text) continue
      const kind = typeof rb.kind === 'string' && (KINDS as readonly string[]).includes(rb.kind) ? rb.kind : 'speech'
      bubbles.push({ kind, text })
    }
    out.push({ scene, bubbles })
  }
  return out
}

function buildPrompt(script: string, target: number, title: string, synopsis: string): string {
  return `You are the Story Director and Storyboard Artist for a premium Korean-style vertical-scroll webtoon (manhwa), in the vein of "Magic Emperor" or "I Am the Fated Villain".

SERIES TITLE: ${title || '(untitled)'}
SERIES PREMISE: ${synopsis || '(none provided)'}
CHAPTER BRIEF: ${script}

Write a complete, engaging chapter and break it into exactly ${target} sequential panels, read top-to-bottom as one continuous vertical scroll. If the brief is short, invent a compelling chapter that fits the series premise, with a clear beginning, rising tension and a hook at the end.

Design ONE main character with a FIXED, specific look (hair, eyes, outfit, build). In every panel that character appears, repeat that same appearance description word-for-word so the art stays visually consistent across panels.

For EACH panel provide:
- "scene": one vivid image-generation prompt for that panel's manhwa art — the setting, the characters (with the fixed appearance), pose, expression, camera framing (wide establishing / close-up / low angle / over-the-shoulder), lighting and mood. Full-color premium manhwa webtoon panel art. Do NOT put any words, letters or captions in the image. 25–45 words.
- "bubbles": the dialogue and narration shown in that panel, as an array of { "kind", "text" } in reading order. "kind" MUST be one of: speech, thought, shout, scream, whisper, narration, electronic — pick the one matching the emotion. Keep each "text" to a line or two. A panel may have zero bubbles.

Also return a top-level "character" string: the main character's FIXED appearance in ~25 words (hair colour & style, eye colour, exact outfit with colours, build, distinguishing features). This exact description is prepended to every panel's art prompt so the character looks the same throughout.

Return ONLY valid minified JSON, no markdown, in exactly this shape:
{"character":"...","panels":[{"scene":"...","bubbles":[{"kind":"narration","text":"..."}]}]}`
}

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required — please sign in again' }, { status: 401 })
  }
  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Script is too long' }, { status: 413 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[/api/ai/storyboard] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { script, title, synopsis } = parsed.data

    const limited = aiRateLimited(uid, 'text')
    if (limited) return limited

    const target = parsed.data.panels ?? Math.max(6, Math.min(MAX_PANELS, Math.round(script.length / 220)))

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildPrompt(script, target, title ?? '', synopsis ?? '') }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    let panels: Panel[] = []
    let character = ''
    try {
      const json = extractJson(text)
      panels = normalizePanels(json)
      const obj = json && typeof json === 'object' ? (json as { character?: unknown }) : {}
      character = asString(obj.character, 300).trim()
    } catch (e) {
      console.error('[/api/ai/storyboard] parse failed:', e)
      return NextResponse.json(
        { error: 'The storyboard came back malformed. Please try again.' },
        { status: 502 },
      )
    }
    if (panels.length === 0) {
      return NextResponse.json(
        { error: 'Could not turn that script into panels. Try adding more detail.' },
        { status: 422 },
      )
    }
    return NextResponse.json({ character, panels })
  } catch (err) {
    console.error('[/api/ai/storyboard] Error:', err)
    return NextResponse.json({ error: 'Storyboard service temporarily unavailable' }, { status: 502 })
  }
}
