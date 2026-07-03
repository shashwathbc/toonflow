// In-memory sliding-window rate limiter with temporary blocking. SERVER ONLY.
//
// Scope note: per-instance memory. Fine for a single Next.js server / small
// deployments; for multi-instance production put Redis (or Upstash) behind the
// same interface — only `checkRateLimit` needs swapping.
import { VIEW_CONFIG } from './config'

interface Bucket {
  timestamps: number[]
  violations: number
  blockedUntil: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  // Opportunistic cleanup so the map can't grow unbounded
  if (now - lastSweep < 60_000) return
  lastSweep = now
  const horizon = now - 60 * 60 * 1000
  for (const [key, b] of buckets) {
    if (b.blockedUntil < now && (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1] < horizon)) {
      buckets.delete(key)
    }
  }
}

export interface RateResult {
  allowed: boolean
  /** true when the key is in a temporary block from repeated violations */
  blocked: boolean
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  sweep(now)

  let b = buckets.get(key)
  if (!b) {
    b = { timestamps: [], violations: 0, blockedUntil: 0 }
    buckets.set(key, b)
  }

  if (b.blockedUntil > now) return { allowed: false, blocked: true }

  b.timestamps = b.timestamps.filter((t) => t > now - windowMs)
  if (b.timestamps.length >= limit) {
    b.violations += 1
    if (b.violations >= VIEW_CONFIG.rateLimits.blockAfterViolations) {
      b.blockedUntil = now + VIEW_CONFIG.rateLimits.blockDurationMs
      b.violations = 0
    }
    return { allowed: false, blocked: b.blockedUntil > now }
  }

  b.timestamps.push(now)
  return { allowed: true, blocked: false }
}
