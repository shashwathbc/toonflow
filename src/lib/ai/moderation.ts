// Content moderation — a deterministic, always-on first-pass screen for the AI
// endpoints (audit finding H2). It runs BEFORE an image prompt is sent to the
// generator and AFTER text is generated, so obviously-prohibited content is
// blocked without adding an API round-trip to the common path.
//
// SCOPE — this is deliberately NARROW. It targets only unambiguous, hard-block
// categories (sexual content involving minors, non-consensual/abuse framing,
// bestiality). It does NOT block general mature fiction (violence, death, war,
// horror), because that is legitimate creative content on this platform — a
// broad denylist would wreck the product with false positives. Think of this as
// the floor, not the ceiling: the real ceiling is a managed image provider's
// safety filter plus a hosted model/vision classifier — wire one in via
// moderateContent() below (AI_MODERATION_URL).

export type ModerationCategory = 'minor_sexual' | 'non_consensual' | 'bestiality'

export interface ModerationResult {
  ok: boolean
  category?: ModerationCategory
}

// Tokens that, on their own, indicate a minor. Kept tight to avoid catching
// ordinary words: \bchild\b does NOT match "childhood"/"childish", and the
// ambiguous "minor" (a *minor* detail) is deliberately excluded so mature adult
// fiction isn't false-flagged.
const MINOR = /\b(?:child|children|toddler|infant|preteen|pre-teen|underage|little (?:boy|girl)|(?:\d|1[0-7])[\s-]?(?:yo|y\/o|years? old|year-old))\b/i

// Sexual/explicit tokens.
const SEXUAL = /\b(?:sex|sexual|nude|naked|nsfw|porn|pornographic|erotic|explicit|genital|penis|vagina|breasts?|nipples?|aroused|orgasm|intercourse|fellatio|masturbat\w*)\b/i

// Standalone hard-block patterns (no combination needed).
const HARD_BLOCK: Array<{ re: RegExp; category: ModerationCategory }> = [
  { re: /\b(?:child porn|csam|loli|shota|lolicon|shotacon)\b/i, category: 'minor_sexual' },
  { re: /\b(?:bestiality|zoophilia)\b/i, category: 'bestiality' },
  { re: /\b(?:rape|non-?consensual|molest\w*)\b.*\b(?:sex\w*|nude|naked|explicit)\b/i, category: 'non_consensual' },
  { re: /\b(?:sex\w*|nude|naked|explicit)\b.*\b(?:rape|non-?consensual|molest\w*)\b/i, category: 'non_consensual' },
]

// ── Obfuscation-resistant second pass ──────────────────────────────────────
// The regexes above rely on word boundaries, so spacing/punctuation/leetspeak
// ("l o l i", "l0li", "c-s-a-m", "ch1ld ... s3x") slips straight past them. We
// ALSO test a "compacted" copy — NFKC-normalized, lowercased, de-leetspeaked,
// then reduced to [a-z0-9] only (which also drops any combining marks, zero-width
// chars or variation selectors used to hide tokens) — against a TIGHT set of
// unambiguous tokens. Tokens that occur inside innocent words (e.g. "child"
// inside "childhood") are excluded here on purpose; the boundary-aware pass above
// already covers those safely, keeping this pass from false-flagging adult fiction.
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
}

function compact(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z0-9]/g, '')
}

// Unambiguous standalone tokens, matched as substrings on the compact string.
const COMPACT_HARD: Array<{ tokens: string[]; category: ModerationCategory }> = [
  { tokens: ['childporn', 'csam', 'lolicon', 'shotacon', 'loli', 'shota'], category: 'minor_sexual' },
  { tokens: ['bestiality', 'zoophilia'], category: 'bestiality' },
]

// Minor indicators safe to substring-match (they don't sit inside common words).
const COMPACT_MINOR = ['toddler', 'infant', 'preteen', 'underage']
const COMPACT_SEXUAL = [
  'sex', 'nude', 'naked', 'nsfw', 'porn', 'erotic', 'explicit', 'genital',
  'penis', 'vagina', 'orgasm', 'intercourse', 'fellatio', 'masturbat',
]

function compactScreen(text: string): ModerationResult {
  const c = compact(text)
  if (!c) return { ok: true }
  for (const { tokens, category } of COMPACT_HARD) {
    if (tokens.some((t) => c.includes(t))) return { ok: false, category }
  }
  if (COMPACT_MINOR.some((m) => c.includes(m)) && COMPACT_SEXUAL.some((s) => c.includes(s))) {
    return { ok: false, category: 'minor_sexual' }
  }
  return { ok: true }
}

/**
 * Screen arbitrary text (an image prompt, a drafted prompt, or generated prose).
 * Returns `{ ok: false, category }` when the text hits a hard-block category,
 * otherwise `{ ok: true }`. Purely deterministic — no network, no throw. Runs
 * both the boundary-aware regex pass and the obfuscation-resistant compact pass.
 */
export function screenContent(text: string): ModerationResult {
  if (!text) return { ok: true }
  const t = text.normalize('NFKC')

  for (const { re, category } of HARD_BLOCK) {
    if (re.test(t)) return { ok: false, category }
  }

  // A minor indicator co-occurring with a sexual indicator is a hard block,
  // regardless of order or distance within the text.
  if (MINOR.test(t) && SEXUAL.test(t)) {
    return { ok: false, category: 'minor_sexual' }
  }

  return compactScreen(text)
}

/** Convenience: true when the text is safe to generate/display. */
export function isAllowed(text: string): boolean {
  return screenContent(text).ok
}

// ── Optional external moderation (vendor wire-point) ───────────────────────
// A deterministic screen can only ever be a floor. When AI_MODERATION_URL is
// set, this ALSO calls a hosted classifier for the real ceiling (nuance, novel
// evasion, and — for image bytes — a vision moderation pass). Contract:
//   POST {input: string}  →  {flagged: boolean, category?: ModerationCategory}
// Send an Authorization: Bearer <AI_MODERATION_KEY> header when that env is set.
//
// Fails OPEN on network/parse error so a moderation-provider outage doesn't take
// the whole product down — pair it with alerting so an outage is visible. Swap
// `screenContent` for `await moderateContent` at the AI route call sites once a
// provider is configured (they are drop-in for the safe path).
export async function moderateContent(text: string): Promise<ModerationResult> {
  const local = screenContent(text)
  if (!local.ok) return local

  const url = process.env.AI_MODERATION_URL
  if (!url) return local

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_MODERATION_KEY ? { Authorization: `Bearer ${process.env.AI_MODERATION_KEY}` } : {}),
      },
      body: JSON.stringify({ input: text }),
    })
    if (!res.ok) return local
    const data = (await res.json()) as { flagged?: boolean; category?: string }
    if (data.flagged) {
      const category = (['minor_sexual', 'non_consensual', 'bestiality'] as const).find(
        (c) => c === data.category,
      )
      return { ok: false, category }
    }
    return { ok: true }
  } catch {
    return local
  }
}
