// POST /api/art/orders/transition — advance an order through its lifecycle and
// settle the creator earnings that depend on it.
//
// ═══════════════ WHO MAY CALL THIS ═══════════════
// Admin only, today. Once a fulfilment provider is connected its signed webhook
// becomes the caller for the production/shipping stages — the same handler,
// entered after signature verification instead of an admin session. Buyers and
// creators can NEVER call it: self-marking an order `delivered` would release
// the creator's own earnings early, and self-marking it `returned` would let a
// buyer claw back a completed sale.
// ═════════════════════════════════════════════════
//
// Every transition is validated against the state machine in
// lib/art/orderLifecycle, so the pipeline cannot run backwards, skip design
// verification, or resurrect a cancelled order.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { bodyTooLarge } from '@/lib/api/guard'
import { AUTH_COOKIE_NAME, SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'
import { loadMarketplaceEconomics } from '@/lib/art/economics.server'
import {
  canTransitionFulfillment,
  canTransitionPayment,
  earningStatusFor,
  releaseDateFor,
  type FulfillmentStatus,
  type PaymentStatus,
} from '@/lib/art/orderLifecycle'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024
const ORDERS = 'orders'
const EARNINGS = 'creatorEarnings'
const AUDIT = 'auditLogs'

const transitionSchema = z
  .object({
    orderId: z.string().min(1).max(128),
    fulfillmentStatus: z
      .enum([
        'design_verified',
        'submitted',
        'in_production',
        'shipped',
        'delivered',
        'cancelled',
        'production_failed',
        'shipping_failed',
        'returned',
      ])
      .optional(),
    paymentStatus: z.enum(['paid', 'failed', 'refunded', 'partially_refunded']).optional(),
    trackingUrl: z.string().url().max(2000).nullable().optional(),
    fulfillmentProvider: z.string().min(1).max(64).nullable().optional(),
  })
  // A call that changes nothing is a bug in the caller, not a no-op we should
  // silently accept — it would still write an audit entry.
  .refine((value) => value.fulfillmentStatus || value.paymentStatus, {
    message: 'Specify a fulfilment or payment transition.',
  })

export async function POST(request: NextRequest) {
  // ── Authorization ─────────────────────────────────────────
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let actorUid: string
  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true)
    if (decoded.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorUid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = transitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid transition' }, { status: 400 })
  }
  const input = parsed.data

  const db = adminDb()
  const economics = await loadMarketplaceEconomics()
  const orderRef = db.collection(ORDERS).doc(input.orderId)

  // The order read, validation and write happen in ONE transaction. Two
  // concurrent transitions (an admin and a webhook, say) would otherwise both
  // read `shipped` and both apply a change the state machine only permits once.
  const result = await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)
      if (!snap.exists) return { error: 'Order not found', status: 404 as const }

      const currentFulfillment = snap.get('fulfillmentStatus') as FulfillmentStatus
      const currentPayment = snap.get('paymentStatus') as PaymentStatus

      const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }

      if (input.fulfillmentStatus) {
        if (!canTransitionFulfillment(currentFulfillment, input.fulfillmentStatus)) {
          return {
            error: `Cannot move a ${currentFulfillment} order to ${input.fulfillmentStatus}.`,
            status: 409 as const,
          }
        }
        patch.fulfillmentStatus = input.fulfillmentStatus
        // Delivery starts the earnings hold clock, so the timestamp is the
        // server's, never the caller's.
        if (input.fulfillmentStatus === 'delivered') {
          patch.deliveredAt = FieldValue.serverTimestamp()
        }
      }

      if (input.paymentStatus) {
        if (!canTransitionPayment(currentPayment, input.paymentStatus)) {
          return {
            error: `Cannot move a ${currentPayment} payment to ${input.paymentStatus}.`,
            status: 409 as const,
          }
        }
        patch.paymentStatus = input.paymentStatus
      }

      if (input.trackingUrl !== undefined) patch.trackingUrl = input.trackingUrl
      if (input.fulfillmentProvider !== undefined) patch.fulfillmentProvider = input.fulfillmentProvider

      tx.update(orderRef, patch)

      return {
        ok: true as const,
        nextFulfillment: (patch.fulfillmentStatus as FulfillmentStatus) ?? currentFulfillment,
        nextPayment: (patch.paymentStatus as PaymentStatus) ?? currentPayment,
      }
    })
    .catch((error) => {
      console.error('[art/orders/transition] transaction failed', error)
      return { error: 'Could not update that order.', status: 500 as const }
    })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // ── Settle the earnings ledger ────────────────────────────
  // Done AFTER the order transaction rather than inside it: the ledger rows are
  // derived state, and a large multi-creator order would otherwise push the
  // transaction past its document limit. Re-derived from the order's authoritative
  // status, so a retry converges on the same answer.
  const orderSnap = await orderRef.get()
  const deliveredAtRaw = orderSnap.get('deliveredAt') as Timestamp | null
  const deliveredAt = deliveredAtRaw ? deliveredAtRaw.toDate() : null

  const status = earningStatusFor({
    paymentStatus: result.nextPayment,
    fulfillmentStatus: result.nextFulfillment,
    deliveredAt,
    holdDays: economics.earningsHoldDays,
    now: new Date(),
  })

  const earningSnaps = await db.collection(EARNINGS).where('orderId', '==', input.orderId).get()
  const batch = db.batch()
  let settled = 0

  for (const doc of earningSnaps.docs) {
    // A line already swept into a completed withdrawal is immutable — reversing
    // it here would silently create a negative balance against money already
    // paid out. Those cases need a manual clawback, not an automatic flip.
    if (doc.get('status') === 'paid_out') continue
    if (doc.get('status') === status) continue

    batch.update(doc.ref, {
      status,
      availableAt:
        status === 'available' && deliveredAt
          ? Timestamp.fromDate(releaseDateFor(deliveredAt, economics.earningsHoldDays))
          : null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    settled += 1
  }

  // Sensitive financial action — audited regardless of whether rows changed.
  batch.set(db.collection(AUDIT).doc(), {
    action: 'art.order.transition',
    actorUid,
    orderId: input.orderId,
    fulfillmentStatus: result.nextFulfillment,
    paymentStatus: result.nextPayment,
    earningStatus: status,
    earningsUpdated: settled,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()

  return NextResponse.json({
    ok: true,
    orderId: input.orderId,
    fulfillmentStatus: result.nextFulfillment,
    paymentStatus: result.nextPayment,
    earningStatus: status,
    earningsUpdated: settled,
  })
}
