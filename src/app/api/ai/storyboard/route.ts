import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { aiRateLimited } from '@/lib/api/aiRateLimit'
import { BUBBLE_DEFS } from '@/lib/editor/bubbles'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BODY_BYTES = 32 * 1024
const MAX_PANELS = 20

// Bubble taxonomy is owned by bubbles.ts — derive both the validation set and
// the model-facing "kind (emotion)" menu from it so they can never drift apart.
const KINDS = BUBBLE_DEFS.map((b) => b.kind) as readonly string[]
const BUBBLE_TAXONOMY = BUBBLE_DEFS.map((b) => `${b.kind} (${b.emotion})`).join(', ')

// Nine placement zones the model picks per bubble so dialogue lands in empty
// negative space (sky, shadow, floor) instead of over faces / key action. The
// agent workflow maps these to actual x/y on the page.
const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'center', 'mid-right',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const

const schema = z.object({
  action: z.enum(['storyboard', 'calculate']).optional(),
  script: z.string().min(1).max(8000),
  title: z.string().max(300).optional(),
  synopsis: z.string().max(4000).optional(),
  panels: z.number().int().min(1).max(MAX_PANELS).optional(),
  pageIndex: z.number().int().min(1).optional(),
  totalPages: z.number().int().min(1).optional(),
  // For one-page-at-a-time generation: the previous shot's BOTTOM transition, so
  // this shot's TOP can continue it and the seam stays invisible.
  prevBottom: z.string().max(400).optional(),
})

interface Bubble { kind: string; text: string; position?: string }
interface Panel { scene: string; palette?: string; motion?: string; bubbles: Bubble[] }

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
    const panel = p && typeof p === 'object' ? (p as { scene?: unknown; palette?: unknown; motion?: unknown; bubbles?: unknown }) : {}
    const scene = asString(panel.scene, 700).trim()
    if (!scene) continue
    const palette = asString(panel.palette, 100).trim()
    const motion = asString(panel.motion, 80).trim()
    const bubblesArr = Array.isArray(panel.bubbles) ? panel.bubbles : []
    const bubbles: Bubble[] = []
    for (const b of bubblesArr.slice(0, 4)) {
      const rb = b && typeof b === 'object' ? (b as { kind?: unknown; text?: unknown; position?: unknown }) : {}
      const text = asString(rb.text, 240).trim()
      if (!text) continue
      const kind = typeof rb.kind === 'string' && KINDS.includes(rb.kind) ? rb.kind : 'speech'
      const position = typeof rb.position === 'string' && (POSITIONS as readonly string[]).includes(rb.position) ? rb.position : undefined
      bubbles.push(position ? { kind, text, position } : { kind, text })
    }
    out.push({ scene, ...(palette ? { palette } : {}), ...(motion ? { motion } : {}), bubbles })
  }
  return out
}

function buildPrompt(
  script: string,
  target: number,
  title: string,
  synopsis: string,
  pageIndex?: number,
  totalPages?: number,
  prevBottom?: string,
): string {
  const perPage = Boolean(pageIndex && totalPages)
  const scopeInstruction = perPage
    ? `Write ONLY shot/panel ${pageIndex} out of ${totalPages} total for this chapter — the specific beat that falls at this exact fraction of the story.${
        prevBottom
          ? ` The reader has just scrolled past the previous shot, which ended with: "${prevBottom}". The TOP of THIS shot MUST continue that element seamlessly so there is no visible seam.`
          : ''
      }`
    : `Write a complete, engaging chapter and break it into exactly ${target} sequential SHOTS, read top-to-bottom as ONE continuous vertical scroll. If the brief is short, invent a compelling chapter that fits the series premise, with a clear beginning, rising tension and a hook at the end.`

  return `You are the Story Director, Storyboard Artist AND Art Director for a premium Korean-style vertical-scroll webtoon (manhwa), in the vein of "Magic Emperor" or "I Am the Fated Villain".

SERIES TITLE: ${title || '(untitled)'}
SERIES PREMISE: ${synopsis || '(none provided)'}
CHAPTER BRIEF: ${script}

${scopeInstruction}

── ONE CONTINUOUS SCROLL (most important rule) ──
This chapter is ONE seamless downward camera move, NOT a set of separate pictures. Think of each panel as a consecutive SHOT of the same moving camera. Consecutive panels MUST fuse at the seam:
• TOP ~20% of a panel visually CONTINUES the bottom of the previous panel — carry the SAME element across (smoke, rain, snow, embers, hair, cloak, a light beam, aura, falling debris, a hand, the horizon).
• CENTER holds this panel's main subject / action.
• BOTTOM ~20% introduces an element that flows into the NEXT panel and teases what's coming, pulling the reader to keep scrolling.
Never reset the world between panels: rain keeps raining, fog/fire/snow and time-of-day persist and evolve smoothly. Reveal subjects gradually across shots (eyes → face → shoulders → body) like a camera pushing in. ${perPage ? 'Even alone, write this shot so its top continues the previous beat and its bottom leads into the next.' : `Panel 1 opens the scene; panel ${target} resolves with a hook.`}

── CHARACTER LOCK ──
Design ONE main character with a FIXED, specific look (hair, eyes, outfit, build). In every panel that character appears, repeat that same appearance description word-for-word so the art stays visually consistent across panels.

── ART DIRECTION & COLOR BIBLE (locks the visual identity for ALL ${perPage ? '' : target + ' '}panels) ──
Act as the Art Director and decide ONE cohesive visual identity for the whole chapter, then hold it identical across every panel — never randomly change the rendering style, saturation, lighting philosophy or color grading. Pick ONE cinematic color-grading reference (e.g. Solo Leveling, Arcane, Your Name, Demon Slayer, Blade Runner) and keep that grade throughout.
Obey the professional 60/30/10 color balance in EVERY panel:
• 60% DOMINANT → background, sky, environment, large surfaces
• 30% SECONDARY → characters, foreground, key props, clothing
• 10% ACCENT → eyes, magic, weapons, energy, fire, key story objects — the accent instantly draws the reader's eye and NEVER exceeds 10%.
Color continuity is mandatory: if the hero's coat is blue it stays blue; if the magic is gold it stays gold; if sunset is orange it never turns purple. Shift the palette only to serve mood (night, flashback, combat, victory) while keeping the same core hues. Keep dialogue-bubble contrast high and readable; no oversaturated colors, no muddy shadows.

For EACH panel provide:
- "scene": ONE vivid image-generation prompt for a TALL 1080×1920 vertical manhwa frame, ~35–55 words. Explicitly cover, in order: (a) what fills the TOP continuing the previous panel, (b) the CENTER main subject with the fixed character look, camera framing (wide establishing / close-up / low angle / over-the-shoulder / extreme close-up), pose, expression, lighting and mood, and (c) what fills the BOTTOM leading into the next panel. Full-color premium manhwa art. Do NOT put any words, letters or captions in the image.
- "motion": 2–5 words naming the ONE element carried across the bottom→top seam into the next panel (e.g. "drifting embers", "falling snow", "billowing cape", "spreading golden light"). Empty string if none.
- "palette": this panel's colors in UNDER 16 words as "dominant <60% colour>, secondary <30% colour>, accent <10% colour>, <lighting + mood>" — obeying the 60/30/10 rule and staying inside the color bible above.
- "bubbles": the dialogue and narration in reading order, as an array of { "kind", "text", "position" }. A panel may have zero bubbles.
  • "kind" MUST be exactly one of (pick the one whose emotion fits the line): ${BUBBLE_TAXONOMY}.
  • "position" MUST be one of: top-left, top-center, top-right, mid-left, center, mid-right, bottom-left, bottom-center, bottom-right. Choose EMPTY negative space (sky, shadow, wall, floor) AWAY from the character's face and the key action described in "scene", so the dialogue never covers important art.
  • Keep each "text" to a line or two.

Also return two top-level strings:
- "character": the main character's FIXED appearance in ~25 words (hair colour & style, eye colour, exact outfit with colours, build, distinguishing features). Prepended to every panel's art prompt so the character looks the same throughout.
- "style": the locked art direction in ~30 words — art style + the chosen cinematic color grading + the core dominant/secondary/accent hues + rendering (clean lineart, cel shading). Prepended to every panel so the whole chapter shares one consistent look and grade.

Return ONLY valid minified JSON, no markdown, in exactly this shape:
{"character":"...","style":"...","panels":[{"scene":"...","motion":"...","palette":"...","bubbles":[{"kind":"narration","text":"...","position":"top-center"}]}]}`
}

function buildCalculatePrompt(script: string): string {
  return `You are a Webtoon Story Director sizing a chapter for a seamless vertical-scroll webtoon where consecutive panels flow into one another as ONE continuous camera move.

CHAPTER BRIEF: ${script}

Decide how many scroll SHOTS (panels) this chapter should have, weighted by the STORY, not the word count:
• Break the brief into its distinct story beats (establishing shot, rising action, reveals, emotional peaks, action climax, closing hook).
• Weight each beat: a big reveal, a fight, or a dramatic entrance earns 2–3 shots so the camera can push in gradually (wide → detail → close-up); a quiet transition or a line of dialogue earns 1.
• Sum the weighted beats. More dramatic/action-heavy or eventful chapters get more shots; a short, calm scene gets fewer.
• Clamp the total to between 6 and ${MAX_PANELS}.

Return ONLY valid minified JSON, no markdown, in exactly this shape:
{"panels": 15}`
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
    const { action, script, title, synopsis, pageIndex, totalPages, prevBottom } = parsed.data

    const limited = aiRateLimited(uid, 'text')
    if (limited) return limited

    if (action === 'calculate') {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildCalculatePrompt(script) }],
      })
      const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
      try {
        const json = extractJson(text) as { panels: number }
        // Clamp to the same [6, MAX_PANELS] band the prompt asks for, in case the
        // model returns something out of range.
        const panels = Math.max(6, Math.min(MAX_PANELS, Math.round(json.panels) || 10))
        return NextResponse.json({ panels })
      } catch {
        return NextResponse.json({ panels: 10 }) // fallback
      }
    }

    const target = parsed.data.panels ?? (pageIndex ? 1 : Math.max(6, Math.min(MAX_PANELS, Math.round(script.length / 220))))

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildPrompt(script, target, title ?? '', synopsis ?? '', pageIndex, totalPages, prevBottom) }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    let panels: Panel[] = []
    let character = ''
    let style = ''
    try {
      const json = extractJson(text)
      panels = normalizePanels(json)
      const obj = json && typeof json === 'object' ? (json as { character?: unknown; style?: unknown }) : {}
      character = asString(obj.character, 300).trim()
      style = asString(obj.style, 400).trim()
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
    return NextResponse.json({ character, style, panels })
  } catch (err) {
    console.error('[/api/ai/storyboard] Error:', err)
    return NextResponse.json({ error: 'Storyboard service temporarily unavailable' }, { status: 502 })
  }
}
