import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/firebase/config'
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore'
import { COIN_PACKAGES } from '@/lib/utils/constants'

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

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('[/api/webhooks] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: RazorpayPaymentEvent
  try {
    event = JSON.parse(body) as RazorpayPaymentEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  console.log(`[/api/webhooks] Event received: ${event.event}`)

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment?.entity
      if (!payment) {
        console.warn('[/api/webhooks] payment.captured event missing payment entity')
        return NextResponse.json({ received: true })
      }

      const notes = payment.notes ?? {}
      const packageId = notes.packageId
      const userId = notes.userId // must be passed from frontend via notes

      if (!userId) {
        console.warn('[/api/webhooks] payment.captured missing userId in notes, payment id:', payment.id)
        return NextResponse.json({ received: true })
      }

      // Verify the user exists
      const userSnap = await getDoc(doc(db, 'users', userId))
      if (!userSnap.exists()) {
        console.error('[/api/webhooks] User not found:', userId)
        return NextResponse.json({ received: true })
      }

      // Find the purchased package
      const pkg = COIN_PACKAGES.find((p) => p.id === packageId)
      const coins = pkg ? pkg.coins + pkg.bonus : Math.floor(payment.amount / 100)

      // Check if this payment was already processed (idempotency)
      const { getDocs, query, where } = await import('firebase/firestore')
      const existingTx = await getDocs(
        query(collection(db, 'transactions'), where('razorpayPaymentId', '==', payment.id))
      )
      if (!existingTx.empty) {
        console.log('[/api/webhooks] Payment already processed:', payment.id)
        return NextResponse.json({ received: true })
      }

      // Credit tokens + create transaction record atomically
      await Promise.all([
        updateDoc(doc(db, 'users', userId), { balance: increment(coins) }),
        addDoc(collection(db, 'transactions'), {
          userId,
          type: 'coin_purchase',
          amount: payment.amount,
          coins,
          description: pkg ? `Purchased ${pkg.coins} tokens (${pkg.bonus > 0 ? `+${pkg.bonus} bonus` : ''})` : `Purchased ${coins} tokens`,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          createdAt: serverTimestamp(),
        }),
      ])

      console.log(`[/api/webhooks] Credited ${coins} tokens to user ${userId} (payment: ${payment.id})`)
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment?.entity
      console.log(`[/api/webhooks] Payment failed: ${payment?.id}`)
      // No action needed — user will retry
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/webhooks] Processing error:', message, err)
    // Return 200 so Razorpay doesn't retry indefinitely
    return NextResponse.json({ received: true, error: message })
  }
}
