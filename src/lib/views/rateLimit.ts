// Rate limiting for view-tracking, AI endpoints, and support.
//
// Single-instance: the synchronous `checkRateLimit` uses an in-memory
// sliding-window counter — fast, no external dependencies, proven stable.
//
// Multi-instance (Cloud Run, multi-replica): an async Upstash Redis variant
// (`checkRateLimitAsync`) is ready to use. When UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, the async version uses Upstash for
// distributed, persistent rate limiting. Without those env vars it falls back
// to the same in-memory logic as the sync version.
//
// Distributed rate limiting (audit H1): every runtime caller now uses
// `await checkRateLimitAsync(...)` — src/app/api/views/route.ts,
// src/app/api/support/route.ts, and src/lib/api/aiRateLimit.ts — so the limiter
// becomes per-cluster the moment Upstash is configured. To activate it:
//   Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Secret Manager and
//   uncomment their references in apphosting.yaml. Until then, checkRateLimitAsync
//   transparently falls back to the in-memory counter below (per process).
// The synchronous `checkRateLimit` is retained only for unit tests / sync callers.
//
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { VIEW_CONFIG } from './config'

export interface RateResult {
  allowed: boolean
  /** true when the key is in a temporary block from repeated violations */
  blocked: boolean
}

// ────────────────────────────────────────────────────────────
//  Synchronous in-memory rate limiter
//  (always available; single-instance safe)
// ────────────────────────────────────────────────────────────

interface Bucket {
  timestamps: number[]
  violations: number
  blockedUntil: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  const horizon = now - 60 * 60 * 1000
  for (const [key, b] of buckets) {
    if (b.blockedUntil < now && (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1] < horizon)) {
      buckets.delete(key)
    }
  }
}

function inMemoryCheck(key: string, limit: number, windowMs: number): RateResult {
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

// ────────────────────────────────────────────────────────────
//  Async Upstash Redis backed rate limiter
//  (for multi-instance deployments; falls back to in-memory)
// ────────────────────────────────────────────────────────────

let upstashInitAttempted = false
let upstashRedis: Redis | null = null

function getUpstashRedis(): Redis | null {
  if (upstashInitAttempted) return upstashRedis
  upstashInitAttempted = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[RateLimit] UPSTASH_REDIS_REST_URL not set — using in-memory rate limiter')
    }
    return null
  }

  try {
    upstashRedis = new Redis({ url, token })
  } catch (e) {
    console.warn('[RateLimit] Failed to connect to Upstash Redis — falling back to in-memory:', e)
  }
  return upstashRedis
}

const limiterCache = new Map<string, Ratelimit>()

function getRatelimit(limit: number, windowMs: number): Ratelimit | null {
  const cacheKey = `${limit}:${windowMs}`
  let limiter = limiterCache.get(cacheKey)
  if (limiter) return limiter

  const redis = getUpstashRedis()
  if (!redis) return null

  const seconds = Math.max(1, Math.floor(windowMs / 1000))
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    analytics: true,
    prefix: 'toonflow:ratelimit',
  })
  limiterCache.set(cacheKey, limiter)
  return limiter
}

const BLOCK_PREFIX = 'toonflow:blocked'

async function isBlockedInRedis(key: string): Promise<boolean> {
  const redis = getUpstashRedis()
  if (!redis) return false
  const val = await redis.get<string>(`${BLOCK_PREFIX}:${key}`)
  return val !== null
}

async function recordViolationInRedis(key: string): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) return
  const violKey = `${BLOCK_PREFIX}:violations:${key}`
  const count = await redis.incr(violKey)
  if (count === 1) await redis.expire(violKey, 3600)
  if (count >= VIEW_CONFIG.rateLimits.blockAfterViolations) {
    await redis.set(`${BLOCK_PREFIX}:${key}`, '1', { ex: Math.floor(VIEW_CONFIG.rateLimits.blockDurationMs / 1000) })
    await redis.del(violKey)
  }
}

// ────────────────────────────────────────────────────────────
//  Exports
// ────────────────────────────────────────────────────────────

/**
 * Synchronous rate-limit check (in-memory, single-instance). Retained for unit
 * tests and any sync-only caller; runtime request handlers use
 * `checkRateLimitAsync` (see the note at the top of this file).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateResult {
  return inMemoryCheck(key, limit, windowMs)
}

/**
 * Async rate-limit check. Uses Upstash Redis when env vars are set,
 * otherwise falls back to the same in-memory logic.
 */
export async function checkRateLimitAsync(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const ratelimit = getRatelimit(limit, windowMs)
  if (ratelimit) {
    const blocked = await isBlockedInRedis(key)
    if (blocked) return { allowed: false, blocked: true }

    const { success } = await ratelimit.limit(key)
    if (!success) {
      await recordViolationInRedis(key)
      return { allowed: false, blocked: false }
    }
    return { allowed: true, blocked: false }
  }

  return inMemoryCheck(key, limit, windowMs)
}

/**
 * Exposed for testing — resets all in-memory buckets.
 */
export function resetRateLimitsForTest(): void {
  buckets.clear()
  lastSweep = Date.now()
}
