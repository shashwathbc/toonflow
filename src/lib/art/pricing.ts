// Marketplace economics. The ONE place a rupee is split.
//
// The model, stated once:
//
//     retail price  −  production cost  −  platform fee  =  creator earnings
//
// Every other file derives from `priceBreakdown()`. Nothing recomputes a split
// inline, because two implementations of a payout formula eventually disagree
// and the disagreement is somebody's money.
//
// ── Why this is not `REVENUE_CONFIG.creatorSharePct` ─────────
// That rate governs the VIEW-based revenue pool, where the platform's only cost
// is infrastructure, so "creator gets 70% of gross" is coherent. Merchandise has
// a per-unit cost of goods: printing and delivering a tee costs ₹399 whether it
// sells for ₹799 or ₹499. Taking a percentage off the gross without subtracting
// that cost pays the creator out of the print bill and loses money on every
// order. Physical goods split the MARGIN, not the gross.
import {
  formatMinor,
  PRICE_BOUNDS,
  productionCostMinor,
  type MaterialId,
  type ProductDefinition,
} from './catalog'

/**
 * Platform-configurable rates. Defaults live here; the admin dashboard may
 * override them per-deployment via `settings/marketplace` (see
 * `loadMarketplaceEconomics` in lib/art/economics.server). A rate that is
 * absent, malformed or out of bounds falls back to the default rather than
 * producing a nonsense split.
 */
export interface MarketplaceEconomics {
  /** Platform commission, as a percent of the RETAIL price. */
  platformFeePct: number
  /** Gateway cost, percent of retail. Carried by the platform, not the creator. */
  paymentGatewayFeePct: number
  /** A listing must leave the creator at least this much, in paise. */
  minCreatorMarginMinor: number
  /** Days after delivery before earnings move pending → available. */
  earningsHoldDays: number
  /** Buyer's return window, in days. Runs concurrently with the hold. */
  returnWindowDays: number
}

export const DEFAULT_ECONOMICS: MarketplaceEconomics = {
  platformFeePct: 10,
  paymentGatewayFeePct: 2,
  minCreatorMarginMinor: 5000,
  earningsHoldDays: 7,
  returnWindowDays: 7,
}

/** Clamp an admin-supplied override into a sane range. */
export function normalizeEconomics(raw: Partial<MarketplaceEconomics> | null | undefined): MarketplaceEconomics {
  const pick = (value: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : NaN
    if (Number.isNaN(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }
  return {
    // A platform fee above 40% is far likelier to be a typo than a policy.
    platformFeePct: pick(raw?.platformFeePct, DEFAULT_ECONOMICS.platformFeePct, 0, 40),
    paymentGatewayFeePct: pick(raw?.paymentGatewayFeePct, DEFAULT_ECONOMICS.paymentGatewayFeePct, 0, 10),
    minCreatorMarginMinor: Math.round(
      pick(raw?.minCreatorMarginMinor, DEFAULT_ECONOMICS.minCreatorMarginMinor, 0, 100_000),
    ),
    earningsHoldDays: Math.round(pick(raw?.earningsHoldDays, DEFAULT_ECONOMICS.earningsHoldDays, 0, 90)),
    returnWindowDays: Math.round(pick(raw?.returnWindowDays, DEFAULT_ECONOMICS.returnWindowDays, 0, 90)),
  }
}

export interface PriceBreakdown {
  /** What the buyer pays for one unit, in paise. */
  retailMinor: number
  /** What it costs to make and deliver one unit, in paise. */
  productionMinor: number
  /** Platform commission on this unit, in paise. */
  platformFeeMinor: number
  /** What the creator earns on this unit, in paise. Never negative. */
  creatorEarningsMinor: number
  /** Gateway cost the platform absorbs — shown for transparency, not deducted
   *  from the creator. */
  gatewayFeeMinor: number
  /** creatorEarnings ÷ retail, as a percent, rounded to 1dp. */
  creatorMarginPct: number
  /** False when retail cannot cover production + fee + the minimum margin. */
  viable: boolean
}

/**
 * Split one unit of revenue. `retailMinor` is the price the buyer pays for this
 * exact variant (base price plus any size surcharge already applied).
 *
 * Rounding: the platform fee is floored, so a rounding remainder always lands on
 * the CREATOR's side of the split rather than the platform's.
 */
export function priceBreakdown(
  retailMinor: number,
  productionMinor: number,
  economics: MarketplaceEconomics = DEFAULT_ECONOMICS,
): PriceBreakdown {
  const retail = Math.max(0, Math.round(retailMinor))
  const production = Math.max(0, Math.round(productionMinor))

  const platformFeeMinor = Math.floor((retail * economics.platformFeePct) / 100)
  const gatewayFeeMinor = Math.floor((retail * economics.paymentGatewayFeePct) / 100)
  // Clamped at zero: a listing priced below cost must never mint a negative
  // payout that a later sum would read as a credit against other earnings.
  const creatorEarningsMinor = Math.max(0, retail - production - platformFeeMinor)

  return {
    retailMinor: retail,
    productionMinor: production,
    platformFeeMinor,
    creatorEarningsMinor,
    gatewayFeeMinor,
    creatorMarginPct: retail === 0 ? 0 : Math.round((creatorEarningsMinor / retail) * 1000) / 10,
    viable: creatorEarningsMinor >= economics.minCreatorMarginMinor,
  }
}

/**
 * The lowest retail price that still clears production, the platform fee and the
 * minimum creator margin. This is the listing FLOOR the API enforces.
 *
 * Solving `retail − production − retail·fee ≥ margin` for retail gives
 * `retail ≥ (production + margin) / (1 − fee)`, which is the right STARTING
 * point but not the answer: `priceBreakdown` floors the fee, so the true
 * minimum can sit a paisa or two either side of the algebraic bound. We search
 * from the estimate instead of trusting it — creator earnings are non-decreasing
 * in retail (each extra paisa of price adds at most one paisa of fee), so the
 * viability boundary is a single crossing and this converges immediately.
 */
export function minimumRetailMinor(
  productionMinor: number,
  economics: MarketplaceEconomics = DEFAULT_ECONOMICS,
): number {
  const isViable = (retail: number) => priceBreakdown(retail, productionMinor, economics).viable
  const feeFraction = economics.platformFeePct / 100
  const estimate = Math.ceil((productionMinor + economics.minCreatorMarginMinor) / (1 - feeFraction))

  let floor = Math.max(PRICE_BOUNDS.minMinor, estimate)
  if (isViable(floor)) {
    // Walk DOWN to the true boundary — but never below the platform's own
    // absolute minimum price.
    while (floor > PRICE_BOUNDS.minMinor && isViable(floor - 1)) floor -= 1
  } else {
    while (floor < PRICE_BOUNDS.maxMinor && !isViable(floor)) floor += 1
  }
  return floor
}

// ── Price recommendation ────────────────────────────────────

export interface PriceSuggestionInput {
  def: ProductDefinition
  material: MaterialId
  /** Representative size used for the quote — the product's mid size. */
  size: string
  /** Layer count / distinct colours, used as a rough complexity proxy. */
  designComplexity?: 'simple' | 'standard' | 'detailed'
  /** Median retail of comparable live listings, in paise, when known. */
  comparableMedianMinor?: number | null
  economics?: MarketplaceEconomics
}

export interface PriceSuggestion {
  suggestedMinor: number
  /** The band we consider healthy — the UI renders this as a slider range. */
  floorMinor: number
  ceilingMinor: number
  breakdown: PriceBreakdown
  /** Plain-language reasons, shown to the creator. Never hidden maths. */
  rationale: string[]
}

const COMPLEXITY_MULTIPLIER: Record<NonNullable<PriceSuggestionInput['designComplexity']>, number> = {
  simple: 0.95,
  standard: 1,
  detailed: 1.12,
}

/**
 * Recommend a price. Deliberately a transparent heuristic rather than a model
 * call: pricing advice that a creator cannot audit is advice they cannot trust,
 * and every input here is one they can see and change.
 *
 * The result is a RECOMMENDATION. The creator's own price is never overwritten
 * by it — the caller applies it only on explicit action.
 */
export function suggestPrice(input: PriceSuggestionInput): PriceSuggestion {
  const economics = input.economics ?? DEFAULT_ECONOMICS
  const production = productionCostMinor(input.def, input.size, input.material)
  const floorMinor = minimumRetailMinor(production, economics)

  const rationale: string[] = []

  // Anchor on the catalogue's suggested retail, adjusted for the fabric the
  // creator actually picked (a dry-fit tee costs more to make than a cotton one).
  const baseline = productionCostMinor(input.def, input.size, input.def.defaultMaterial)
  let anchor = input.def.suggestedRetailMinor + (production - baseline)
  rationale.push(`${input.def.label} on ${input.material.replace('-', ' ')} costs ${formatMinor(production)} to produce and deliver.`)

  const complexity = input.designComplexity ?? 'standard'
  if (complexity !== 'standard') {
    anchor = Math.round(anchor * COMPLEXITY_MULTIPLIER[complexity])
    rationale.push(
      complexity === 'detailed'
        ? 'Detailed multi-layer designs support a higher price.'
        : 'Simpler designs sell better slightly below the category norm.',
    )
  }

  // Pull toward the live market when we have real comparables. Weighted at 40%
  // so a thin or skewed sample can't drag a listing to an unviable price.
  if (input.comparableMedianMinor && input.comparableMedianMinor > 0) {
    anchor = Math.round(anchor * 0.6 + input.comparableMedianMinor * 0.4)
    rationale.push(
      `Similar live listings sit around ${formatMinor(input.comparableMedianMinor)} — the suggestion is weighted toward that.`,
    )
  }

  // Round to a ₹9-ending price point, then re-clamp: the rounding must never
  // push the number below the viability floor.
  const rounded = Math.max(floorMinor, roundToPricePoint(anchor))
  const suggestedMinor = Math.min(PRICE_BOUNDS.maxMinor, rounded)
  const breakdown = priceBreakdown(suggestedMinor, production, economics)

  rationale.push(
    `At ${formatMinor(suggestedMinor)} you earn ${formatMinor(breakdown.creatorEarningsMinor)} per sale (${breakdown.creatorMarginPct}%).`,
  )

  return {
    suggestedMinor,
    floorMinor,
    // A healthy ceiling, not a hard cap — the creator may price above it.
    ceilingMinor: Math.min(PRICE_BOUNDS.maxMinor, roundToPricePoint(Math.round(suggestedMinor * 1.6))),
    breakdown,
    rationale,
  }
}

/** Snap to a ₹__9 price point (79900 → 79900, 81234 → 81900). */
export function roundToPricePoint(minor: number): number {
  const rupees = Math.round(minor / 100)
  if (rupees < 100) return Math.max(1, Math.round(rupees / 10) * 10 - 1) * 100
  const hundreds = Math.round(rupees / 100) * 100
  return Math.max(100, hundreds - 1) * 100
}

/** Sum a set of breakdowns — used by the cart and the order ledger. */
export function sumBreakdowns(lines: { breakdown: PriceBreakdown; quantity: number }[]) {
  return lines.reduce(
    (acc, { breakdown, quantity }) => ({
      retailMinor: acc.retailMinor + breakdown.retailMinor * quantity,
      productionMinor: acc.productionMinor + breakdown.productionMinor * quantity,
      platformFeeMinor: acc.platformFeeMinor + breakdown.platformFeeMinor * quantity,
      creatorEarningsMinor: acc.creatorEarningsMinor + breakdown.creatorEarningsMinor * quantity,
      gatewayFeeMinor: acc.gatewayFeeMinor + breakdown.gatewayFeeMinor * quantity,
    }),
    { retailMinor: 0, productionMinor: 0, platformFeeMinor: 0, creatorEarningsMinor: 0, gatewayFeeMinor: 0 },
  )
}
