import { describe, it, expect, beforeEach } from 'vitest'
import type { RateResult } from './rateLimit'
import { checkRateLimit, resetRateLimitsForTest } from './rateLimit'

describe('in-memory sliding-window rate limiter', () => {
  beforeEach(() => resetRateLimitsForTest())

  it('allows up to the limit, then denies further requests in the window', () => {
    const key = 'burst'
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    const denied = checkRateLimit(key, 3, 60_000)
    expect(denied.allowed).toBe(false)
    expect(denied.blocked).toBe(false) // a single over-limit hit is not yet a block
  })

  it('tracks each key independently', () => {
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(true)
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit('b', 1, 60_000).allowed).toBe(true) // 'b' unaffected by 'a'
  })

  it('escalates to a temporary block after repeated violations', () => {
    const key = 'abuser'
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true) // consumes the only slot
    let last: RateResult = { allowed: true, blocked: false }
    for (let i = 0; i < 5; i++) last = checkRateLimit(key, 1, 60_000) // 5 violations
    expect(last.allowed).toBe(false)
    expect(last.blocked).toBe(true) // blockAfterViolations = 5 → now temporarily blocked
    expect(checkRateLimit(key, 1, 60_000).blocked).toBe(true) // stays blocked
  })
})
