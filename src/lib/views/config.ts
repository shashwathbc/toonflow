// View-tracking configuration. All thresholds are enforced SERVER-SIDE;
// the client mirrors them only to decide when to fire the request.

export const VIEW_CONFIG = {
  /** One counted view per visitor per content within this rolling window. */
  dedupWindowMs: 24 * 60 * 60 * 1000, // 24h

  /** Server-measured dwell (token issue → completion) that alone qualifies a view.
   *  Product choice: count a view after a few seconds of genuine reading. The
   *  client mirror (useViewTracking) fires ABOVE this so network jitter between
   *  the begin/complete round-trips can never leave server dwell below the floor. */
  minDwellMs: 5_000,

  /** Scroll depth that qualifies a view (combined with a small dwell floor). */
  minScrollPercent: 50,
  /** Minimum server dwell even when the scroll threshold is met (anti scroll-jacking). */
  minDwellWithScrollMs: 3_000,

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
