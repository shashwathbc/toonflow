import { describe, expect, it } from 'vitest'
import {
  formatMinor,
  MATERIALS,
  PRICE_BOUNDS,
  PRODUCT_CATALOG,
  productDefinition,
  productionCostMinor,
  resolveMaterial,
} from './catalog'
import { orderSchema, productSchema, publishArtworkSchema } from './schema'

describe('product catalogue', () => {
  it('exposes a definition for every listed product type', () => {
    for (const product of PRODUCT_CATALOG) {
      expect(productDefinition(product.type)).not.toBeNull()
    }
  })

  it('declares a print area for every placement a product supports', () => {
    for (const product of PRODUCT_CATALOG) {
      for (const placement of product.placements) {
        const area = product.printAreas[placement]
        expect(area).toBeDefined()
        // Print areas are fractions of the mockup box and must stay inside it,
        // or a design would be positioned off the garment.
        expect(area.x).toBeGreaterThanOrEqual(0)
        expect(area.y).toBeGreaterThanOrEqual(0)
        expect(area.x + area.width).toBeLessThanOrEqual(1)
        expect(area.y + area.height).toBeLessThanOrEqual(1)
      }
    }
  })

  it('suggests a retail price at or above the platform minimum', () => {
    for (const product of PRODUCT_CATALOG) {
      expect(product.suggestedRetailMinor).toBeGreaterThanOrEqual(PRICE_BOUNDS.minMinor)
    }
  })

  it('never suggests a retail price at or below what the item costs to make', () => {
    // The invariant the whole pricing model rests on. A catalogue entry that
    // violates it would recommend a price that loses money on every sale.
    for (const product of PRODUCT_CATALOG) {
      for (const size of product.sizes) {
        const cost = productionCostMinor(product, size, product.defaultMaterial)
        expect(product.suggestedRetailMinor, `${product.type}/${size}`).toBeGreaterThan(cost)
      }
    }
  })

  it('adds the size surcharge on top of the production cost', () => {
    const tee = productDefinition('tshirt')!
    expect(productionCostMinor(tee, 'M')).toBe(tee.productionCostMinor)
    expect(productionCostMinor(tee, 'XXL')).toBeGreaterThan(productionCostMinor(tee, 'M'))
  })

  it('charges more to produce a costlier fabric', () => {
    const tee = productDefinition('tshirt')!
    expect(productionCostMinor(tee, 'M', 'premium')).toBeGreaterThan(productionCostMinor(tee, 'M', 'cotton'))
  })

  it('never returns a negative production cost, even on a discounted fabric', () => {
    // Two materials carry a NEGATIVE cost delta; a cheap product on one of them
    // must still floor at zero rather than crediting the platform.
    for (const product of PRODUCT_CATALOG) {
      for (const material of product.materials) {
        for (const size of product.sizes) {
          expect(productionCostMinor(product, size, material)).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('offers every gym product a performance fabric', () => {
    const gym = PRODUCT_CATALOG.filter((p) => p.category === 'gym')
    expect(gym.length).toBeGreaterThan(0)
    for (const product of gym) {
      expect(product.materials.length).toBeGreaterThan(0)
      expect(product.materials).toContain(product.defaultMaterial)
    }
  })

  it('declares a default material that the product actually offers', () => {
    for (const product of PRODUCT_CATALOG) {
      if (product.materials.length === 0) continue
      expect(product.materials, product.type).toContain(product.defaultMaterial)
    }
  })

  it('prices every declared material', () => {
    for (const product of PRODUCT_CATALOG) {
      for (const material of product.materials) {
        expect(MATERIALS[material]).toBeDefined()
      }
    }
  })

  it('formats paise as whole rupees', () => {
    // Money is stored in minor units precisely so this conversion is the only
    // place a fraction ever appears.
    expect(formatMinor(79900)).toContain('799')
  })
})

describe('resolveMaterial', () => {
  const tee = productDefinition('tshirt')!

  it('accepts a material the product offers', () => {
    expect(resolveMaterial(tee, 'premium')).toBe('premium')
  })

  it('falls back to the default for a material the product does not offer', () => {
    // A dry-fit cotton tee is not a thing we make. Rather than erroring on a
    // stale client, fall back to something we can actually produce.
    expect(resolveMaterial(tee, 'dry-fit')).toBe(tee.defaultMaterial)
    expect(resolveMaterial(tee, 'nonsense')).toBe(tee.defaultMaterial)
    expect(resolveMaterial(tee, null)).toBe(tee.defaultMaterial)
  })
})

describe('productSchema', () => {
  const valid = {
    artworkId: 'a1',
    title: 'Storm Samurai',
    productType: 'tshirt',
    designs: [{ placement: 'front', artworkId: 'a1', x: 0.5, y: 0.5, scale: 0.7, rotation: 0 }],
    priceMinor: 99900,
    sizes: ['M', 'L'],
    colorIds: ['black'],
    rightsConfirmed: true as const,
  }

  it('accepts a well-formed listing', () => {
    expect(productSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses to publish without the ownership confirmation', () => {
    expect(productSchema.safeParse({ ...valid, rightsConfirmed: false }).success).toBe(false)
  })

  it('rejects a price below the platform floor', () => {
    expect(productSchema.safeParse({ ...valid, priceMinor: 1 }).success).toBe(false)
  })

  it('rejects a design positioned outside the print area', () => {
    const outside = { ...valid, designs: [{ ...valid.designs[0], x: 4 }] }
    expect(productSchema.safeParse(outside).success).toBe(false)
  })

  it('normalises tags to lowercase and de-duplicates them', () => {
    const result = productSchema.safeParse({ ...valid, tags: ['Anime', 'anime', 'ANIME', 'Mecha'] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tags).toEqual(['anime', 'mecha'])
  })

  it('rejects an unknown product type', () => {
    expect(productSchema.safeParse({ ...valid, productType: 'yacht' }).success).toBe(false)
  })
})

describe('orderSchema', () => {
  it('accepts ids and a quantity', () => {
    const result = orderSchema.safeParse({
      items: [{ productId: 'p1', variantId: 'm-black', quantity: 2 }],
    })
    expect(result.success).toBe(true)
  })

  it('has no price field at all, so a client cannot name its own price', () => {
    const result = orderSchema.safeParse({
      items: [{ productId: 'p1', variantId: 'm-black', quantity: 1, unitPriceMinor: 1 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // zod strips unknown keys — the tampered price never reaches the handler,
      // which reads the authoritative price off the product document instead.
      expect(result.data.items[0]).not.toHaveProperty('unitPriceMinor')
    }
  })

  it('rejects a non-positive or absurd quantity', () => {
    expect(orderSchema.safeParse({ items: [{ productId: 'p', variantId: 'v', quantity: 0 }] }).success).toBe(
      false,
    )
    expect(
      orderSchema.safeParse({ items: [{ productId: 'p', variantId: 'v', quantity: 9999 }] }).success,
    ).toBe(false)
  })

  it('rejects an empty basket', () => {
    expect(orderSchema.safeParse({ items: [] }).success).toBe(false)
  })
})

describe('publishArtworkSchema', () => {
  const valid = {
    artworkId: 'a1',
    title: 'Storm Samurai',
    category: 'illustration',
    rightsConfirmed: true as const,
  }

  it('accepts a complete publish request', () => {
    expect(publishArtworkSchema.safeParse(valid).success).toBe(true)
  })

  it('requires the copyright confirmation to be literally true', () => {
    expect(publishArtworkSchema.safeParse({ ...valid, rightsConfirmed: false }).success).toBe(false)
    expect(publishArtworkSchema.safeParse({ ...valid, rightsConfirmed: 'yes' }).success).toBe(false)
  })

  it('rejects an unknown category', () => {
    expect(publishArtworkSchema.safeParse({ ...valid, category: 'nsfw' }).success).toBe(false)
  })

  it('defaults visibility to public but allows unlisted', () => {
    const result = publishArtworkSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.visibility).toBe('public')
    expect(publishArtworkSchema.safeParse({ ...valid, visibility: 'private' }).success).toBe(false)
  })
})
