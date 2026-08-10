import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/serverApp'
import { COIN_PACKAGES } from '@/lib/utils/constants'

export const runtime = 'nodejs'

interface RazorpayPaymentEvent {
  entity: string
  account_id: string
  event: string
  contains: string[]
  payload: {
    payment?: {
      entity: {
        id: string
        order_id: string
        amount: number
        currency: string
        status: string
        notes: Record<string, string>
        contact?: string
        email?: string
      }
    }
    order?: {
      entity: {
        id: string
        receipt: string
        notes: Record<string, string>
      }
    }
  }
}

/** Constant-time compare that can't throw on length mismatch. */
function signaturesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[/api/webhooks] RAZORPAY_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const signature = request.headers.get('x-razorpay-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const body = await request.text()

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  if (!signaturesMatch(signature, expectedSignature)) {
    console.warn('[/api/webhooks] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: RazorpayPaymentEvent
  try {
    event = JSON.parse(body) as RazorpayPaymentEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment?.entity
      if (!payment) {
        return NextResponse.json({ received: true })
      }

      const notes = payment.notes ?? {}
      const packageId = notes.packageId
      const userId = notes.userId // set server-side in create-order from the verified uid

      if (!userId) {
        console.warn('[/api/webhooks] payment.captured missing userId in notes, payment id:', payment.id)
        return NextResponse.json({ received: true })
      }

      // Coins come ONLY from the trusted package catalog — never from the raw
      // payment amount. Every order we create (/api/payments/create-order) sets a
      // valid packageId, so an unknown one means the order didn't originate from
      // us: ack the webhook to stop Razorpay retries, but credit nothing.
      const pkg = COIN_PACKAGES.find((p) => p.id === packageId)
      if (!pkg) {
        console.warn('[/api/webhooks] payment.captured with unknown packageId:', packageId, '— crediting nothing. payment id:', payment.id)
        return NextResponse.json({ received: true })
      }

      // Defence-in-depth (audit L1): the price for a package is fixed in the
      // catalog and /api/payments/create-order always charges pkg.priceInr*100
      // paise. If the captured amount doesn't match, this capture didn't come
      // from an order we issued — ack to stop retries, but credit nothing.
      const expectedPaise = pkg.priceInr * 100
      if (payment.amount !== expectedPaise) {
        console.warn(
          '[/api/webhooks] amount mismatch for package', packageId,
          '— expected', expectedPaise, 'paise, got', payment.amount,
          '— crediting nothing. payment id:', payment.id,
        )
        return NextResponse.json({ received: true })
      }

      const coins = pkg.coins + pkg.bonus

      const db = adminDb()
      const userRef = db.doc(`users/${userId}`)
      // Idempotency + credit as one transaction so a webhook retry can't
      // double-credit and a race can't drop the update.
      const txRef = db.collection('transactions').doc(`rzp_${payment.id}`)

      await db.runTransaction(async (tx) => {
        const [userSnap, txSnap] = await Promise.all([tx.get(userRef), tx.get(txRef)])
        if (!userSnap.exists) {
          console.error('[/api/webhooks] User not found:', userId)
          return
        }
        if (txSnap.exists) {
          // Already processed this payment.
          return
        }
        tx.update(userRef, { balance: FieldValue.increment(coins) })
        tx.set(txRef, {
          userId,
          type: 'coin_purchase',
          amount: payment.amount,
          coins,
          description: `Purchased ${pkg.coins} tokens${pkg.bonus > 0 ? ` (+${pkg.bonus} bonus)` : ''}`,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          createdAt: FieldValue.serverTimestamp(),
        })
      })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // Log the detail server-side only. Echoing err.message back put internal
    // failure text (Firestore paths, SDK internals) on the wire to whoever holds
    // the webhook secret — needless exposure for a body nobody reads.
    console.error('[/api/webhooks] Processing error:', err)
    // Return 200 so Razorpay doesn't retry indefinitely on a bug on our side.
    return NextResponse.json({ received: true })
  }
}
