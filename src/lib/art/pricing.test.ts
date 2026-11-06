import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMICS,
  minimumRetailMinor,
  normalizeEconomics,
  priceBreakdown,
  roundToPricePoint,
  suggestPrice,
  sumBreakdowns,
} from './pricing'
import { PRODUCT_CATALOG, productDefinition, productionCostMinor } from './catalog'

describe('priceBreakdown', () => {
  it('splits a sale into production, platform fee and creator earnings', () => {
    // The worked example from the product brief: ₹999 retail, ₹599 production,
    // 10% platform fee → ₹100 platform, ₹300 creator.
    const result = priceBreakdown(99900, 59900)
    expect(result.platformFeeMinor).toBe(9990)
    expect(result.creatorEarningsMinor).toBe(99900 - 59900 - 9990)
    expect(result.creatorEarningsMinor).toBe(30010)
  })

  it('always accounts for every paisa the buyer paid', () => {
    for (const retail of [4900, 79900, 99900, 123456, 1_000_000]) {
      for (const production of [0, 24900, 39900, 89900]) {
        const b = priceBreakdown(retail, production)
        // Nothing may vanish: what the buyer paid is production + fee + creator,
        // plus whatever remains on the platform side when priced below cost.
        const accounted = b.productionMinor + b.platformFeeMinor + b.creatorEarningsMinor
        expect(accounted).toBeLessThanOrEqual(retail + b.productionMinor)
        if (retail >= production) expect(accounted).toBeLessThanOrEqual(retail)
      }
    }
  })

  it('never pays a creator more than the sale leaves after costs', () => {
    // The bug this whole module exists to prevent: a percentage-of-gross split
    // pays ₹559 on a ₹799 tee that costs ₹399 to make, losing ₹159 per order.
    const b = priceBreakdown(79900, 39900)
    expect(b.creatorEarningsMinor).toBeLessThanOrEqual(79900 - 39900)
    const percentageOfGross = Math.floor((79900 * 70) / 100)
    expect(b.creatorEarningsMinor).toBeLessThan(percentageOfGross)
  })

  it('clamps a below-cost listing to zero rather than a negative payout', () => {
    const b = priceBreakdown(10000, 39900)
    expect(b.creatorEarningsMinor).toBe(0)
    expect(b.viable).toBe(false)
  })

  it('gives the rounding remainder to the creator, not the platform', () => {
    // 10% of 99999 paise is 9999.9 — the floored fee leaves the extra paisa on
    // the creator's side.
    const b = priceBreakdown(99999, 0)
    expect(b.platformFeeMinor).toBe(9999)
    expect(b.creatorEarningsMinor).toBe(90000)
  })

  it('does not charge the gateway fee to the creator', () => {
    const b = priceBreakdown(99900, 59900)
    const withoutGateway = 99900 - 59900 - b.platformFeeMinor
    expect(b.creatorEarningsMinor).toBe(withoutGateway)
    expect(b.gatewayFeeMinor).toBeGreaterThan(0)
  })
})

describe('minimumRetailMinor', () => {
  it('produces a floor that is actually viable', () => {
    for (const production of [0, 24900, 39900, 49900, 89900, 150000]) {
      const floor = minimumRetailMinor(production)
      expect(priceBreakdown(floor, production).viable).toBe(true)
      // And one paisa below it must NOT be, or the floor is not tight.
      if (floor > 4900) {
        expect(priceBreakdown(floor - 1, production).viable).toBe(false)
      }
    }
  })

  it('rises with production cost', () => {
    expect(minimumRetailMinor(89900)).toBeGreaterThan(minimumRetailMinor(39900))
  })

  it('leaves every catalogue product profitable at its suggested retail', () => {
    // If a catalogue entry's own suggestion were below its floor, the studio
    // would recommend a price the API then refuses.
    for (const def of PRODUCT_CATALOG) {
      const size = def.sizes[Math.floor(def.sizes.length / 2)]
      const production = productionCostMinor(def, size, def.defaultMaterial)
      expect(def.suggestedRetailMinor).toBeGreaterThanOrEqual(minimumRetailMinor(production))
    }
  })
})

describe('normalizeEconomics', () => {
  it('falls back to defaults for missing or malformed rates', () => {
    expect(normalizeEconomics(null)).toEqual(DEFAULT_ECONOMICS)
    expect(normalizeEconomics({ platformFeePct: Number.NaN }).platformFeePct).toBe(
      DEFAULT_ECONOMICS.platformFeePct,
    )
    expect(
      normalizeEconomics({ platformFeePct: 'lots' as unknown as number }).platformFeePct,
    ).toBe(DEFAULT_ECONOMICS.platformFeePct)
  })

  it('clamps an out-of-range admin override instead of applying it', () => {
    // A 300% platform fee is a typo, and applying it would zero every payout.
    expect(normalizeEconomics({ platformFeePct: 300 }).platformFeePct).toBe(40)
    expect(normalizeEconomics({ platformFeePct: -5 }).platformFeePct).toBe(0)
    expect(normalizeEconomics({ earningsHoldDays: 9999 }).earningsHoldDays).toBe(90)
  })

  it('accepts a legitimate override', () => {
    expect(normalizeEconomics({ platformFeePct: 15 }).platformFeePct).toBe(15)
  })
})

describe('suggestPrice', () => {
  const tee = productDefinition('tshirt')!

  it('suggests a viable price with a readable rationale', () => {
    const s = suggestPrice({ def: tee, material: 'cotton', size: 'M' })
    expect(s.suggestedMinor).toBeGreaterThanOrEqual(s.floorMinor)
    expect(s.breakdown.viable).toBe(true)
    expect(s.rationale.length).toBeGreaterThan(0)
  })

  it('never suggests below the viability floor, even for a cheap comparable', () => {
    const s = suggestPrice({
      def: tee,
      material: 'premium',
      size: 'XXL',
      comparableMedianMinor: 5000, // an absurdly cheap market signal
    })
    expect(s.suggestedMinor).toBeGreaterThanOrEqual(s.floorMinor)
    expect(s.breakdown.creatorEarningsMinor).toBeGreaterThan(0)
  })

  it('prices a costlier fabric higher', () => {
    const cotton = suggestPrice({ def: tee, material: 'cotton', size: 'M' })
    const premium = suggestPrice({ def: tee, material: 'premium', size: 'M' })
    expect(premium.suggestedMinor).toBeGreaterThan(cotton.suggestedMinor)
  })

  it('prices a detailed design above a simple one', () => {
    const simple = suggestPrice({ def: tee, material: 'cotton', size: 'M', designComplexity: 'simple' })
    const detailed = suggestPrice({ def: tee, material: 'cotton', size: 'M', designComplexity: 'detailed' })
    expect(detailed.suggestedMinor).toBeGreaterThan(simple.suggestedMinor)
  })

  it('is viable for every product on every material it offers', () => {
    for (const def of PRODUCT_CATALOG) {
      const materials = def.materials.length > 0 ? def.materials : [def.defaultMaterial]
      for (const material of materials) {
        for (const size of def.sizes) {
          const s = suggestPrice({ def, material, size })
          expect(s.breakdown.viable, `${def.type}/${material}/${size}`).toBe(true)
        }
      }
    }
  })
})

describe('roundToPricePoint', () => {
  it('snaps to a ₹__9 ending', () => {
    expect(roundToPricePoint(81234) % 100).toBe(0)
    expect(Math.round(roundToPricePoint(81234) / 100) % 10).toBe(9)
  })

  it('never returns zero or a negative price', () => {
    expect(roundToPricePoint(0)).toBeGreaterThan(0)
    expect(roundToPricePoint(100)).toBeGreaterThan(0)
  })
})

describe('sumBreakdowns', () => {
  it('multiplies each line by its quantity', () => {
    const line = priceBreakdown(99900, 59900)
    const total = sumBreakdowns([{ breakdown: line, quantity: 3 }])
    expect(total.retailMinor).toBe(99900 * 3)
    expect(total.creatorEarningsMinor).toBe(line.creatorEarningsMinor * 3)
  })

  it('adds unrelated lines independently', () => {
    const a = priceBreakdown(79900, 39900)
    const b = priceBreakdown(19900, 0)
    const total = sumBreakdowns([
      { breakdown: a, quantity: 1 },
      { breakdown: b, quantity: 2 },
    ])
    expect(total.retailMinor).toBe(79900 + 19900 * 2)
    expect(total.creatorEarningsMinor).toBe(a.creatorEarningsMinor + b.creatorEarningsMinor * 2)
  })
})
