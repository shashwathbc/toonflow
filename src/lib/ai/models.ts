// Central registry of Claude model IDs used across the AI routes (audit M7).
//
// Keeping every model choice here means tier changes are one edit, not a grep
// across routes, and the cost/quality trade-off is visible in one place.
//
// All IDs below are verified available for this Anthropic account (live probe
// logged in .claude/CHANGES.md, 2026-07-29): claude-opus-4-8, claude-sonnet-5,
// claude-sonnet-4-6, and claude-haiku-4-5-20251001 all return 200.
export const AI_MODELS = {
  /** Full-chapter generation — highest quality, long output. */
  chapter: 'claude-opus-4-8',
  /** Interactive story-assistant chat. Upgraded from claude-sonnet-4-6 to the
   *  current Sonnet tier for stronger continuity and craft (M7). */
  chat: 'claude-sonnet-5',
  /** Storyboard / art-direction pass. Haiku keeps the per-panel cost low; move to
   *  `chat` if an A/B shows materially better beat/continuity quality (M7). */
  storyboard: 'claude-haiku-4-5-20251001',
  /** Cheap helpers: image-prompt drafting, synopsis, chapter sizing, summaries. */
  helper: 'claude-haiku-4-5-20251001',
} as const
