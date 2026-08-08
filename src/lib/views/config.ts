// View-tracking configuration. All thresholds are enforced SERVER-SIDE;
// the client mirrors them only to decide when to fire the request.

export const VIEW_CONFIG = {
  /** Duplicate-REQUEST window, not a per-day cap.
   *
   *  Product rule: every time a chapter/episode is opened it counts as a view.
   *  A single open can still produce more than one `complete` request though —
   *  React Strict Mode remounts the reader in development, a retried fetch can
   *  land twice, a double-tapped link mounts the page twice — so the first
   *  completion inside this window wins and the rest are dropped. Re-opening the
   *  same chapter after the window counts again, on purpose.
   *
   *  Inflation is bounded by the per-IP / per-visitor / per-session rate limits
   *  below, which is where abuse is actually handled. */
  dedupWindowMs: 10 * 1000, // 10s

  /** Server-measured dwell (token issue → completion) required to qualify a view.
   *  Product choice: a view counts as soon as the chapter/episode is OPENED —
   *  there is no minimum reading time. Kept at 0 so any valid, non-bot,
   *  non-duplicate completion counts. Per-user counting still holds because the
   *  24h per-visitor dedup below makes it one view per user (not per refresh),
   *  and bot detection / rate limits / token + visitor-cookie validation all
   *  still apply. */
  minDwellMs: 0,

  /** Scroll depth that qualifies a view. No longer gates counting (minDwellMs is
   *  0), but the scroll figure is still recorded for analytics. */
  minScrollPercent: 50,
  /** Minimum server dwell even when the scroll threshold is met. */
  minDwellWithScrollMs: 0,

  /** A view token older than this is stale and rejected (prevents replay of old tokens). */
  tokenMaxAgeMs: 6 * 60 * 60 * 1000, // 6h

  /** Anonymous visitor cookie lifetime. */
  visitorCookieMaxAgeSec: 60 * 60 * 24 * 365, // 1 year
  visitorCookieName: 'tf_vid',

  rateLimits: {
    /** begin-phase requests (token issuance) */
    beginPerIp: { limit: 120, windowMs: 10 * 60 * 1000 },
    /** complete-phase requests */
    completePerIp: { limit: 60, windowMs: 10 * 60 * 1000 },
    completePerVisitor: { limit: 30, windowMs: 10 * 60 * 1000 },
    completePerSession: { limit: 30, windowMs: 10 * 60 * 1000 },
    /** Repeated violations put the key in a temporary block. */
    blockAfterViolations: 5,
    blockDurationMs: 15 * 60 * 1000,
  },
} as const

export type ViewContentType = 'chapter' | 'episode'

export function isViewContentType(v: unknown): v is ViewContentType {
  return v === 'chapter' || v === 'episode'
}
