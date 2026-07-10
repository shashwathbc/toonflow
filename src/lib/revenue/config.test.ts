import { describe, it, expect } from 'vitest'
import {
  REVENUE_CONFIG,
  CREATOR_EARNINGS_PER_VIEW,
  CREATOR_RPM,
  GROSS_CPM,
  viewsToCreatorInr,
  revenueBreakdown,
  fmtInr,
} from './config'

describe('revenue config', () => {
  it('derives creator earnings per view from gross × creator share, with no float tail', () => {
    // 0.01 gross × 70% = 0.007 exactly (not 0.007000000000000001)
    expect(CREATOR_EARNINGS_PER_VIEW).toBe(0.007)
  })

  it('derives RPM and gross CPM per 1,000 views', () => {
    expect(CREATOR_RPM).toBe(7)
    expect(GROSS_CPM).toBe(10)
  })

  it('floors creator earnings to paise', () => {
    expect(viewsToCreatorInr(0)).toBe(0)
    expect(viewsToCreatorInr(1000)).toBe(7)
    // 1 view = 0.007 INR → floored to 0.00
    expect(viewsToCreatorInr(1)).toBe(0)
    // 100 views = 0.70 INR
    expect(viewsToCreatorInr(100)).toBe(0.7)
  })

  it('keeps the allocation split summing to 100%', () => {
    const total = REVENUE_CONFIG.allocation.reduce((s, a) => s + a.pct, 0)
    expect(total).toBe(100)
  })

  it('protects the creator cut in the full breakdown (fees hit the platform side)', () => {
    const b = revenueBreakdown(100_000, 'subscription')
    expect(b.grossInr).toBeCloseTo(1000, 5)
    expect(b.creatorInr).toBeCloseTo(700, 5) // 70%
    expect(b.platformGrossInr).toBeCloseTo(300, 5)
    expect(b.platformProfitInr).toBeGreaterThanOrEqual(0)
    // creator + platformGross reconstruct gross
    expect(b.creatorInr + b.platformGrossInr).toBeCloseTo(b.grossInr, 5)
  })

  it('pays creators less under the ad model (60%) than subscription (70%)', () => {
    const sub = revenueBreakdown(100_000, 'subscription')
    const ads = revenueBreakdown(100_000, 'ads')
    expect(ads.creatorInr).toBeLessThan(sub.creatorInr)
    expect(ads.creatorInr).toBeCloseTo(600, 5)
  })

  it('formats INR currency', () => {
    expect(fmtInr(0)).toContain('0')
    expect(typeof fmtInr(199)).toBe('string')
  })
})
