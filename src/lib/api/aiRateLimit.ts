// Per-user rate limiting for the AI endpoints. Every AI call hits a paid
// provider (Anthropic / Stability AI) and is free to end users, so an
// authenticated account looping a route is a direct vendor-spend DoS. Auth
// (verifiedUid) ties usage to a real account; this caps how fast that account
// can spend on our behalf.
//
// Buckets are sized by cost: heavy generation (Opus chapters, Stability images)
// is capped tighter than cheap Haiku text. Reuses the in-memory sliding-window
// limiter in '@/lib/views/rateLimit' — swap that one file for Redis when the app
// runs multi-instance (its counters are per-process).
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/views/rateLimit'

const HOUR = 60 * 60 * 1000

/** Per-hour ceilings, keyed by cost tier. */
export const AI_LIMITS = {
  /** Stability AI image generation — most expensive per call. */
  image: { limit: 20, windowMs: HOUR },
  /** Cheap Haiku helpers: image-prompt drafting, synopsis generation. */
  text: { limit: 40, windowMs: HOUR },
  /** Interactive story-assistant chat (Sonnet). */
  assistChat: { limit: 60, windowMs: HOUR },
  /** Full-chapter generation (Opus, long output) — expensive, cap hard. */
  assistChapter: { limit: 20, windowMs: HOUR },
} as const

export type AiBucket = keyof typeof AI_LIMITS

/**
 * Returns a 429 response if `uid` has exceeded the bucket's hourly ceiling,
 * otherwise `null` (proceed). Call after verifiedUid and before contacting the
 * provider.
 */
export function aiRateLimited(uid: string, bucket: AiBucket): NextResponse | null {
  const { limit, windowMs } = AI_LIMITS[bucket]
  if (checkRateLimit(`ai:${bucket}:${uid}`, limit, windowMs).allowed) return null
  return NextResponse.json(
    { error: "You've reached the AI usage limit for now. Please try again in a little while." },
    { status: 429 }
  )
}
