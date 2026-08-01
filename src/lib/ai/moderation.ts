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
// safety filter plus a model/vision classifier (the H1/H2 follow-up), which
// plug in at the same call sites.

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

/**
 * Screen arbitrary text (an image prompt, a drafted prompt, or generated prose).
 * Returns `{ ok: false, category }` when the text hits a hard-block category,
 * otherwise `{ ok: true }`. Purely deterministic — no network, no throw.
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

  return { ok: true }
}

/** Convenience: true when the text is safe to generate/display. */
export function isAllowed(text: string): boolean {
  return screenContent(text).ok
}
