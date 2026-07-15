// Illustrative creator earnings ESTIMATES — the single source of truth for both
// the /earnings Revenue Calculator and the dashboard "Estimated Monthly Earnings"
// table, so the two can never drift.
//
// IMPORTANT: these are illustrative blended estimates (ads + premium chapters +
// subscription share + tips), NOT payout rates. Real per-view payouts come from
// REVENUE_CONFIG.grossPerViewInr and are unaffected by anything in this file.

export interface EarningEstimateTier {
  subscribers: number
  monthlyViews: number
  lowInr: number
  /** null = open-ended top tier (rendered as "low+") */
  highInr: number | null
}

export const EARNING_ESTIMATE_TIERS: EarningEstimateTier[] = [
  { subscribers: 1_000, monthlyViews: 10_000, lowInr: 500, highInr: 3_000 },
  { subscribers: 5_000, monthlyViews: 100_000, lowInr: 5_000, highInr: 20_000 },
  { subscribers: 25_000, monthlyViews: 1_000_000, lowInr: 30_000, highInr: 120_000 },
  { subscribers: 100_000, monthlyViews: 10_000_000, lowInr: 200_000, highInr: 800_000 },
  { subscribers: 1_000_000, monthlyViews: 100_000_000, lowInr: 2_000_000, highInr: null },
]

/** Illustrative revenue-stream mix used to break an estimate down. Sums to 100. */
export const ESTIMATE_STREAM_MIX = [
  { key: 'ads', label: 'Advertisement revenue', pct: 40 },
  { key: 'subscriptions', label: 'Subscription share', pct: 30 },
  { key: 'premium', label: 'Premium chapters', pct: 20 },
  { key: 'tips', label: 'Reader tips', pct: 10 },
] as const

/** Resolve a concrete high for an open-ended tier by extending the previous tier's low→high ratio. */
function highOf(i: number): number {
  const t = EARNING_ESTIMATE_TIERS[i]
  if (t.highInr != null) return t.highInr
  const prev = EARNING_ESTIMATE_TIERS[i - 1]
  const ratio = prev && prev.highInr != null ? prev.highInr / prev.lowInr : 4
  return t.lowInr * ratio
}

/**
 * Blended monthly earnings estimate (low–high, INR) for a monthly view count.
 * Log–log interpolation between the tier anchors, so any view count maps to a
 * smooth band that passes exactly through EARNING_ESTIMATE_TIERS. Pure.
 */
function estimateByViews(views: number): { lowInr: number; highInr: number } {
  const tiers = EARNING_ESTIMATE_TIERS
  const v = views < 1 ? 1 : views
  const first = tiers[0]
  const last = tiers[tiers.length - 1]

  // Below the smallest anchor: scale linearly from zero at tier 1's per-view rate.
  if (v <= first.monthlyViews) {
    const f = v / first.monthlyViews
    return { lowInr: first.lowInr * f, highInr: highOf(0) * f }
  }
  // At/above the largest anchor: extend at the top tier's per-view rate.
  if (v >= last.monthlyViews) {
    const f = v / last.monthlyViews
    return { lowInr: last.lowInr * f, highInr: highOf(tiers.length - 1) * f }
  }
  // Between two anchors: geometric (log–log) interpolation.
  for (let i = 0; i < tiers.length - 1; i++) {
    const a = tiers[i]
    const b = tiers[i + 1]
    if (v >= a.monthlyViews && v <= b.monthlyViews) {
      const t = (Math.log(v) - Math.log(a.monthlyViews)) / (Math.log(b.monthlyViews) - Math.log(a.monthlyViews))
      const geo = (x: number, y: number) => Math.exp(Math.log(x) + t * (Math.log(y) - Math.log(x)))
      return { lowInr: geo(a.lowInr, b.lowInr), highInr: geo(highOf(i), highOf(i + 1)) }
    }
  }
  return { lowInr: last.lowInr, highInr: highOf(tiers.length - 1) }
}

/** The monthly views a subscriber count "supports" — interpolated along the
 * (subscribers → views) anchor pairs. Lets subscribers gate the estimate. */
function subscribersToViews(subscribers: number): number {
  const tiers = EARNING_ESTIMATE_TIERS
  const s = subscribers < 1 ? 1 : subscribers
  const first = tiers[0]
  const last = tiers[tiers.length - 1]
  if (s <= first.subscribers) return first.monthlyViews * (s / first.subscribers)
  if (s >= last.subscribers) return last.monthlyViews * (s / last.subscribers)
  for (let i = 0; i < tiers.length - 1; i++) {
    const a = tiers[i]
    const b = tiers[i + 1]
    if (s >= a.subscribers && s <= b.subscribers) {
      const t = (Math.log(s) - Math.log(a.subscribers)) / (Math.log(b.subscribers) - Math.log(a.subscribers))
      return Math.exp(Math.log(a.monthlyViews) + t * (Math.log(b.monthlyViews) - Math.log(a.monthlyViews)))
    }
  }
  return last.monthlyViews
}

/**
 * Blended monthly earnings estimate (low–high, INR) from BOTH subscribers and
 * monthly views. Earnings are gated by the *limiting* factor — you only reach a
 * tier's range once your subscribers AND your views both support it, so climbing
 * the plan requires growing subscribers too (not views alone). Passes exactly
 * through EARNING_ESTIMATE_TIERS at each (subscribers, views) anchor pair. Pure.
 */
export function estimateMonthlyEarnings(subscribers: number, views: number): { lowInr: number; highInr: number } {
  const effectiveViews = Math.min(views, subscribersToViews(subscribers))
  return estimateByViews(effectiveViews)
}
