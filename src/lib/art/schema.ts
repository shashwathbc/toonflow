// Zod schemas for every Art Studio / marketplace request body.
import { z } from 'zod'
import { ART_CATEGORIES } from '@/types/art'
import { MATERIAL_IDS, PRICE_BOUNDS, PRODUCT_TYPES } from './catalog'

const idSchema = z.string().min(1).max(128)
const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(12)
  .default([])
  // Tags are rendered and searched, so normalise them here rather than trusting
  // whatever casing/duplication the client sent.
  .transform((tags) => Array.from(new Set(tags.map((t) => t.toLowerCase()))))

/** POST /api/art/publish — take a draft artwork public. */
export const publishArtworkSchema = z.object({
  artworkId: idSchema,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  category: z.enum(ART_CATEGORIES),
  tags: tagsSchema,
  /**
   * The creator's ownership assertion. Publishing is refused without it — this
   * is the copyright confirmation step, not a checkbox for decoration.
   */
  rightsConfirmed: z.literal(true),
  visibility: z.enum(['public', 'unlisted']).default('public'),
})

/** POST /api/art/publish with `action: 'unpublish'`. */
export const unpublishArtworkSchema = z.object({
  artworkId: idSchema,
  action: z.literal('unpublish'),
})

const placementSchema = z.object({
  placement: z.enum(['front', 'back', 'left-sleeve', 'right-sleeve']),
  artworkId: idSchema,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(0.05).max(1),
  rotation: z.number().min(-180).max(180),
})

/** POST /api/art/products — create or update a product listing. */
export const productSchema = z.object({
  productId: idSchema.optional(),
  artworkId: idSchema,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  productType: z.enum(PRODUCT_TYPES as [string, ...string[]]),
  /** Fabric choice. Validated against the product's own material list server-side. */
  materialId: z.enum(MATERIAL_IDS).optional(),
  tags: tagsSchema,
  designs: z.array(placementSchema).min(1).max(4),
  /**
   * Creator's asking price in PAISE. Bounded here and re-checked server-side
   * against the price FLOOR computed from production cost, platform fee and the
   * minimum creator margin — a listing below that floor loses money every sale.
   */
  priceMinor: z.number().int().min(PRICE_BOUNDS.minMinor).max(PRICE_BOUNDS.maxMinor),
  sizes: z.array(z.string().min(1).max(16)).min(1).max(12),
  colorIds: z.array(z.string().min(1).max(24)).max(12).default([]),
  previewURL: z.string().url().max(2000).nullable().default(null),
  publish: z.boolean().default(false),
  rightsConfirmed: z.literal(true),
})

/** POST /api/art/orders — begin a purchase. */
export const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: idSchema,
        variantId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
  /**
   * Client-generated key that makes a retried checkout return the ORIGINAL
   * order instead of creating a second one. Optional so an older client still
   * works; when absent the caller simply forfeits replay protection.
   */
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
  shipping: z
    .object({
      name: z.string().trim().min(2).max(120),
      line1: z.string().trim().min(2).max(200),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(100),
      postalCode: z.string().trim().min(3).max(20),
      country: z.string().trim().min(2).max(60),
      phone: z.string().trim().max(24).optional(),
    })
    .optional(),
})

export type PublishArtworkInput = z.infer<typeof publishArtworkSchema>
export type ProductInput = z.infer<typeof productSchema>
export type OrderInput = z.infer<typeof orderSchema>
