// POST /api/art/orders — begin a purchase.
//
// ═══════════════ INTEGRATION BOUNDARY ═══════════════
// Physical merchandise cannot be produced or shipped until a fulfilment
// provider is connected (see lib/art/fulfillment). This route therefore REFUSES
// orders containing physical items with code `fulfillment_not_configured`
// rather than taking money for something nobody can make. Digital artwork has
// no such dependency, but still needs the payment gateway wired to the existing
// Razorpay flow before an order can settle — until then a digital order is
// created in `pending` and never marked paid by anything but a verified webhook.
// ════════════════════════════════════════════════════
//
// SECURITY: prices come from the PRODUCT DOCUMENT, never from the request. The
// client sends ids and quantities only — the classic e-commerce tampering
// vector is a body that carries `price`, and there is deliberately no such
// field in the schema.
//
// ECONOMICS: the creator's earnings are computed by lib/art/pricing from the
// variant's snapshotted production cost, NOT as a percentage of gross. See the
// header of that module for why a percentage-of-gross split loses money on
// every physical unit.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { orderSchema } from '@/lib/art/schema'
import { isFulfillmentConfigured, requiresFulfillment } from '@/lib/art/fulfillment'
import { loadMarketplaceEconomics } from '@/lib/art/economics.server'
import { priceBreakdown } from '@/lib/art/pricing'
import { productDefinition, productionCostMinor, resolveMaterial } from '@/lib/art/catalog'
import { PRODUCTS } from '@/lib/firebase/art'
import type { OrderItem, ProductType, ProductVariant } from '@/types/art'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16 * 1024
const ORDERS = 'orders'
const EARNINGS = 'creatorEarnings'

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Please sign in to complete your purchase.' }, { status: 401 })

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`art:order:${uid}`, 20, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many checkout attempts. Please try again shortly.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 })
  }
  const { items, shipping, idempotencyKey } = parsed.data

  const db = adminDb()

  // ── Idempotency ───────────────────────────────────────────
  // A retried or double-submitted checkout must return the ORIGINAL order, not
  // create a second one. The key is scoped to the buyer so it cannot be used to
  // probe or collide with anyone else's orders.
  if (idempotencyKey) {
    const existing = await db
      .collection(ORDERS)
      .where('buyerId', '==', uid)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get()
    const prior = existing.docs[0]
    if (prior) {
      return NextResponse.json({
        orderId: prior.id,
        totalMinor: prior.get('totalMinor') as number,
        paymentStatus: prior.get('paymentStatus') as string,
        paymentReady: false,
        idempotent: true,
      })
    }
  }

  const economics = await loadMarketplaceEconomics()
  const snaps = await Promise.all(items.map((item) => db.collection(PRODUCTS).doc(item.productId).get()))

  const orderItems: OrderItem[] = []
  let needsFulfillment = false

  for (let i = 0; i < items.length; i++) {
    const line = items[i]
    const snap = snaps[i]
    if (!snap.exists || snap.get('status') !== 'published') {
      return NextResponse.json({ error: 'One of those products is no longer available.' }, { status: 409 })
    }

    const ownerId = snap.get('ownerId') as string
    if (ownerId === uid) {
      return NextResponse.json({ error: "You can't buy your own product." }, { status: 400 })
    }

    const variants = (snap.get('variants') as ProductVariant[] | undefined) ?? []
    const variant = variants.find((v) => v.id === line.variantId)
    if (!variant) {
      return NextResponse.json({ error: 'That option is no longer available.' }, { status: 409 })
    }
    if (variant.availability === 'unavailable') {
      return NextResponse.json({ error: `${snap.get('title')} (${variant.size}) is out of stock.` }, { status: 409 })
    }

    const productType = snap.get('productType') as ProductType
    if (requiresFulfillment(productType)) needsFulfillment = true

    // Authoritative price, straight off the product document.
    const unitPriceMinor = variant.priceMinor

    // Production cost: prefer the value snapshotted onto the variant at listing
    // time. Listings created before that field existed fall back to a fresh
    // catalogue computation — never to zero, which would silently pay the
    // creator the platform's print bill.
    const def = productDefinition(productType)
    const unitProductionCostMinor =
      typeof variant.productionCostMinor === 'number'
        ? variant.productionCostMinor
        : def
          ? productionCostMinor(def, variant.size, resolveMaterial(def, snap.get('materialId') as string))
          : null

    if (unitProductionCostMinor === null) {
      return NextResponse.json({ error: 'One of those products is no longer available.' }, { status: 409 })
    }

    const split = priceBreakdown(unitPriceMinor, unitProductionCostMinor, economics)
    orderItems.push({
      productId: snap.id,
      variantId: variant.id,
      title: snap.get('title') as string,
      productType,
      quantity: line.quantity,
      unitPriceMinor,
      unitProductionCostMinor: split.productionMinor,
      unitPlatformFeeMinor: split.platformFeeMinor,
      creatorId: ownerId,
      // Per-unit earnings × quantity, so the line total is exact rather than a
      // second rounding of an already-rounded figure.
      creatorEarningsMinor: split.creatorEarningsMinor * line.quantity,
    })
  }

  if (needsFulfillment && !isFulfillmentConfigured()) {
    return NextResponse.json(
      {
        error:
          'Physical merchandise ordering is not open yet — print and delivery are still being connected. Digital artwork is available to buy now.',
        code: 'fulfillment_not_configured',
      },
      { status: 503 },
    )
  }
  if (needsFulfillment && !shipping) {
    return NextResponse.json({ error: 'A delivery address is required for physical items.' }, { status: 400 })
  }

  const subtotalMinor = orderItems.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0)

  const ref = db.collection(ORDERS).doc()
  const batch = db.batch()

  batch.set(ref, {
    buyerId: uid,
    items: orderItems,
    subtotalMinor,
    totalMinor: subtotalMinor,
    currency: 'INR',
    // Cash and token purchases are separate ledgers. Only cash is wired today.
    paymentMethod: 'money',
    tokenCost: 0,
    // Nothing is paid until a VERIFIED payment webhook says so. Creating the
    // order does not move money and must never look as though it did.
    paymentStatus: 'pending',
    fulfillmentStatus: 'not_started',
    trackingUrl: null,
    fulfillmentProvider: null,
    deliveredAt: null,
    idempotencyKey: idempotencyKey ?? null,
    // Shipping details are stored only when the order actually needs delivery.
    shipping: needsFulfillment ? shipping : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // ── Earnings ledger ───────────────────────────────────────
  // One document per creator per line, opened in `pending`. It is NOT payable
  // yet: the payment webhook and the delivery transition move it along, and
  // lib/art/orderLifecycle decides when it becomes withdrawable. Writing it now
  // (rather than at delivery) means the creator can see the sale immediately and
  // the ledger has a row for every order that ever existed.
  for (const item of orderItems) {
    const earningRef = db.collection(EARNINGS).doc(`${ref.id}_${item.productId}_${item.variantId}`)
    batch.set(earningRef, {
      creatorId: item.creatorId,
      orderId: ref.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.title,
      quantity: item.quantity,
      grossMinor: item.unitPriceMinor * item.quantity,
      productionCostMinor: item.unitProductionCostMinor * item.quantity,
      platformFeeMinor: item.unitPlatformFeeMinor * item.quantity,
      netMinor: item.creatorEarningsMinor,
      status: 'pending',
      availableAt: null,
      withdrawalId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()

  return NextResponse.json({
    orderId: ref.id,
    totalMinor: subtotalMinor,
    paymentStatus: 'pending',
    // The client uses this to route into the existing Razorpay flow once the
    // marketplace gateway is enabled; today it tells the UI to show the
    // "payment not connected" state instead of a fake success screen.
    paymentReady: false,
  })
}
