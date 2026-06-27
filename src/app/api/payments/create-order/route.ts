import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { COIN_PACKAGES } from '@/lib/utils/constants'

// Razorpay order creation — requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local
export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('toonflow-auth-token')?.value
  if (!authToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.error('[/api/payments/create-order] Razorpay keys not configured')
    return NextResponse.json(
      { error: 'Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { packageId: string; priceInr: number }
    const pkg = COIN_PACKAGES.find((p) => p.id === body.packageId)
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
    }

    // Amount in paise (1 INR = 100 paise)
    const amountInPaise = pkg.priceInr * 100

    // Create a unique receipt id
    const receipt = `tok_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

    const orderPayload = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: { packageId: pkg.id, coins: pkg.coins + pkg.bonus },
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })

    if (!razorpayResponse.ok) {
      const err = await razorpayResponse.json().catch(() => ({})) as { error?: { description?: string } }
      const msg = err.error?.description ?? `Razorpay error ${razorpayResponse.status}`
      console.error('[/api/payments/create-order] Razorpay error:', msg)
      return NextResponse.json({ error: msg }, { status: razorpayResponse.status })
    }

    const order = await razorpayResponse.json() as { id: string; amount: number; currency: string }
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/payments/create-order] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
