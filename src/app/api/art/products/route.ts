// POST /api/art/products — create or update a merchandise / digital listing.
//
// Product listings are server-written for one reason: they carry PRICE. A
// client-writable price document is a client-writable invoice — a buyer could
// rewrite a hoodie to ₹1 before checkout, or a seller could list below
// production cost and turn every sale into a platform loss. So firestore.rules
// denies all client writes to /products, variants are BUILT here from the
// catalogue (never accepted from the body), and the creator's only pricing input
// is a single bounded number that must clear the computed price FLOOR.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { productSchema } from '@/lib/art/schema'
import { formatMinor, productDefinition, productionCostMinor, resolveMaterial } from '@/lib/art/catalog'
import { loadMarketplaceEconomics } from '@/lib/art/economics.server'
import { minimumRetailMinor, priceBreakdown } from '@/lib/art/pricing'
import { isFulfillmentConfigured, requiresFulfillment } from '@/lib/art/fulfillment'
import { screenContent } from '@/lib/ai/moderation'
import { ARTWORKS, PRODUCTS } from '@/lib/firebase/art'
import type { ProductType, ProductVariant } from '@/types/art'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 24 * 1024

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`art:product:${uid}`, 60, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many product updates. Please try again shortly.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const message =
      issue?.path?.[0] === 'rightsConfirmed'
        ? 'Please confirm you own the rights to this design.'
        : (issue?.message ?? 'Invalid product')
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const input = parsed.data
  const productType = input.productType as ProductType
  const def = productDefinition(productType)
  if (!def) return NextResponse.json({ error: 'Unknown product type' }, { status: 400 })

  if (!screenContent(`${input.title} ${input.description} ${input.tags.join(' ')}`).ok) {
    return NextResponse.json({ error: 'This listing was blocked by our content policy.' }, { status: 422 })
  }

  const db = adminDb()

  // ── Every referenced artwork must be the caller's own ─────
  // Otherwise a creator could print someone else's published artwork on a tee
  // and collect the earnings — the design ids come from the request body, so
  // this is the check that makes them safe to trust.
  const artworkIds = Array.from(new Set([input.artworkId, ...input.designs.map((d) => d.artworkId)]))
  const artworkSnaps = await Promise.all(artworkIds.map((id) => db.collection(ARTWORKS).doc(id).get()))
  const missing = artworkSnaps.find((snap) => !snap.exists || snap.get('ownerId') !== uid)
  if (missing) {
    return NextResponse.json({ error: 'One of those artworks is unavailable.' }, { status: 403 })
  }

  // Placements must be ones this product actually supports (a cap has no sleeve).
  const unsupported = input.designs.find((d) => !def.placements.includes(d.placement))
  if (unsupported) {
    return NextResponse.json(
      { error: `${def.label} does not support a ${unsupported.placement.replace('-', ' ')} print.` },
      { status: 400 },
    )
  }

  // Sizes/colours must exist in the catalogue.
  const sizes = input.sizes.filter((size) => (def.sizes as readonly string[]).includes(size))
  if (sizes.length === 0) {
    return NextResponse.json({ error: 'Pick at least one available size.' }, { status: 400 })
  }
  const colors = def.colors.filter((c) => input.colorIds.includes(c.id))
  if (def.colors.length > 0 && colors.length === 0) {
    return NextResponse.json({ error: 'Pick at least one colour.' }, { status: 400 })
  }

  // Print resolution — a design below the catalogue minimum prints as mush.
  const primary = artworkSnaps.find((snap) => snap.id === input.artworkId)
  const width = Number(primary?.get('width') ?? 0)
  const height = Number(primary?.get('height') ?? 0)
  if (productType !== 'digital' && (width < def.minArtworkPx.width || height < def.minArtworkPx.height)) {
    return NextResponse.json(
      {
        error: `${def.label} needs artwork at least ${def.minArtworkPx.width}×${def.minArtworkPx.height}px. Yours is ${width}×${height}px.`,
        code: 'resolution_too_low',
      },
      { status: 400 },
    )
  }

  // ── Price floor ───────────────────────────────────────────
  // The creator names ONE price, for the smallest size on their chosen fabric;
  // every variant is derived from it plus that variant's production delta.
  //
  // The floor is not the production cost — it is the retail price at which the
  // sale still clears production AND the platform fee AND leaves the creator
  // the minimum margin. Pricing at bare production cost would pay the creator
  // nothing and the platform less than nothing.
  const material = resolveMaterial(def, input.materialId)
  const economics = await loadMarketplaceEconomics()
  const baseSize = sizes[0]
  const baseProduction = productionCostMinor(def, baseSize, material)
  const floorMinor = minimumRetailMinor(baseProduction, economics)

  if (input.priceMinor < floorMinor) {
    return NextResponse.json(
      {
        error: `The minimum price for a ${def.label.toLowerCase()} on ${material.replace('-', ' ')} is ${formatMinor(floorMinor)}. That covers ${formatMinor(baseProduction)} production plus the platform fee, and still leaves you a margin.`,
        code: 'price_below_floor',
        floorMinor,
      },
      { status: 400 },
    )
  }

  const colorList = colors.length > 0 ? colors : [{ id: 'default', name: 'Default', hex: '#000000', dark: true }]
  const variants: ProductVariant[] = []
  for (const size of sizes) {
    // Each size costs a different amount to make; the surcharge is passed
    // through to the buyer so the creator's margin stays flat across sizes.
    const unitProduction = productionCostMinor(def, size, material)
    const priceMinor = input.priceMinor + (unitProduction - baseProduction)
    for (const color of colorList) {
      variants.push({
        id: `${size}-${color.id}`.toLowerCase(),
        size,
        colorId: color.id,
        colorName: color.name,
        priceMinor,
        // Snapshotted so a later catalogue cost change cannot retroactively
        // rewrite the economics of an order placed against this listing.
        productionCostMinor: unitProduction,
        // Honest default: without a fulfilment provider we genuinely do not
        // know whether this can be produced, so we never claim "in stock".
        availability: requiresFulfillment(productType)
          ? isFulfillmentConfigured()
            ? 'available'
            : 'unknown'
          : 'available',
      })
    }
  }
  const fromPriceMinor = Math.min(...variants.map((v) => v.priceMinor))

  // Every variant must be viable, not just the base one. A size surcharge that
  // outpaced the price would otherwise create a loss-making variant inside an
  // otherwise healthy listing.
  const unviable = variants.find((v) => !priceBreakdown(v.priceMinor, v.productionCostMinor, economics).viable)
  if (unviable) {
    return NextResponse.json(
      {
        error: `At this price the ${unviable.size} variant would not cover its production cost. Raise the price or drop that size.`,
        code: 'variant_below_floor',
      },
      { status: 400 },
    )
  }

  const ref = input.productId ? db.collection(PRODUCTS).doc(input.productId) : db.collection(PRODUCTS).doc()

  if (input.productId) {
    const existing = await ref.get()
    if (!existing.exists || existing.get('ownerId') !== uid) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
  }

  // Publishing a physical product requires the artwork itself to be public —
  // the listing shows it, so an unpublished design would leak through the shop.
  if (input.publish && primary?.get('status') !== 'published') {
    return NextResponse.json(
      { error: 'Publish the artwork before putting it on a product.', code: 'artwork_not_published' },
      { status: 400 },
    )
  }

  const userSnap = await db.collection('users').doc(uid).get()

  const payload: Record<string, unknown> = {
    ownerId: uid,
    ownerName: (userSnap.get('displayName') as string) ?? 'Creator',
    ownerPhotoURL: (userSnap.get('photoURL') as string | null) ?? null,
    artworkId: input.artworkId,
    title: input.title,
    description: input.description,
    productType,
    materialId: material,
    tags: input.tags,
    designs: input.designs,
    variants,
    fromPriceMinor,
    currency: 'INR',
    previewURL: input.previewURL,
    status: input.publish ? 'published' : 'draft',
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (!input.productId) {
    payload.viewCount = 0
    payload.likeCount = 0
    payload.salesCount = 0
    payload.createdAt = FieldValue.serverTimestamp()
    payload.publishedAt = input.publish ? FieldValue.serverTimestamp() : null
  } else if (input.publish) {
    payload.publishedAt = FieldValue.serverTimestamp()
  }

  await ref.set(payload, { merge: true })

  return NextResponse.json({
    ok: true,
    productId: ref.id,
    status: payload.status,
    variants: variants.length,
    fromPriceMinor,
    // Surfaced so the UI can tell the creator exactly why physical orders can't
    // be taken yet, instead of silently listing something unbuyable.
    fulfillmentConnected: isFulfillmentConfigured(),
  })
}
