// Revenue model — single source of truth for every rate on the platform.
// The dashboard, the public earnings page, the revenue calculator and the
// server-side analytics all read from here, so changing a business rate is a
// one-line edit that stays consistent everywhere.
//
// IMPORTANT: grossPerViewInr drives real creator payouts (dashboard "Total
// Earned" and withdrawal availability). Treat changes as a business decision.

export const REVENUE_CONFIG = {
  /** Gross platform revenue attributed to one validated view (INR). */
  grossPerViewInr: 0.01,

  /** Subscription revenue-pool split (percent). */
  creatorSharePct: 70,
  platformSharePct: 30,

  /** Ad revenue split (percent) — displayed model, ads not live yet. */
  adCreatorSharePct: 60,
  adPlatformSharePct: 40,

  /** Reader premium subscription (INR / month). */
  subscriptionPriceInr: 199,

  /** Deductions applied to the PLATFORM side of the split (percent of gross). */
  paymentGatewayFeePct: 2,
  taxPct: 18, // GST on platform revenue
  operationalCostPct: 5,

  /** Payouts */
  minWithdrawalInr: 200,
  payoutSchedule: '3–5 business days',

  /** "Where your money goes" — must sum to 100. */
  allocation: [
    { pct: 35, title: 'AI Infrastructure', items: ['GPU servers', 'LLMs', 'Image generation', 'Storage'] },
    { pct: 20, title: 'Platform Development', items: ['Frontend', 'Backend', 'Mobile apps', 'Security', 'New features'] },
    { pct: 15, title: 'Cloud Infrastructure', items: ['Firebase', 'CDN', 'Storage', 'Database', 'Bandwidth'] },
    { pct: 10, title: 'Creator Support', items: ['Customer success', 'Moderation', 'Community'] },
    { pct: 10, title: 'Marketing', items: ['User acquisition', 'Events', 'Ads', 'Creator growth'] },
    { pct: 10, title: 'Operations', items: ['Legal', 'Finance', 'Compliance', 'Taxes', 'Support'] },
  ],
} as const

/** Round to `dp` decimal places, killing binary floating-point tails
 * (e.g. 0.01 * 70 / 100 → 0.007000000000000001). */
function round(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** What the creator earns per validated view (INR). Rounded to sub-paise so the
 * value is exactly 0.007, not 0.007000000000000001. */
export const CREATOR_EARNINGS_PER_VIEW =
  round((REVENUE_CONFIG.grossPerViewInr * REVENUE_CONFIG.creatorSharePct) / 100, 6)

/** Creator revenue-per-mille — ₹ per 1,000 views. */
export const CREATOR_RPM = round(CREATOR_EARNINGS_PER_VIEW * 1000, 2)

/** Gross cost-per-mille — platform gross ₹ per 1,000 views. */
export const GROSS_CPM = round(REVENUE_CONFIG.grossPerViewInr * 1000, 2)

/** Creator earnings for a view count, floored to paise. */
export function viewsToCreatorInr(views: number): number {
  return Math.floor(views * CREATOR_EARNINGS_PER_VIEW * 100) / 100
}

export interface RevenueBreakdown {
  grossInr: number
  creatorInr: number
  platformGrossInr: number
  gatewayFeesInr: number
  taxesInr: number
  operationalInr: number
  platformProfitInr: number
}

/**
 * Full revenue breakdown for a view count under either split model.
 * Gateway fees / taxes / ops are carried by the platform's share — the
 * creator's cut is protected.
 */
export function revenueBreakdown(
  views: number,
  model: 'subscription' | 'ads' = 'subscription',
): RevenueBreakdown {
  const creatorPct = model === 'subscription'
    ? REVENUE_CONFIG.creatorSharePct
    : REVENUE_CONFIG.adCreatorSharePct

  const grossInr = views * REVENUE_CONFIG.grossPerViewInr
  const creatorInr = (grossInr * creatorPct) / 100
  const platformGrossInr = grossInr - creatorInr
  const gatewayFeesInr = (grossInr * REVENUE_CONFIG.paymentGatewayFeePct) / 100
  const taxesInr = (platformGrossInr * REVENUE_CONFIG.taxPct) / 100
  const operationalInr = (grossInr * REVENUE_CONFIG.operationalCostPct) / 100
  const platformProfitInr = Math.max(0, platformGrossInr - gatewayFeesInr - taxesInr - operationalInr)

  return { grossInr, creatorInr, platformGrossInr, gatewayFeesInr, taxesInr, operationalInr, platformProfitInr }
}

export function fmtInr(n: number, maxFraction = 2): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: maxFraction,
  }).format(n)
}
