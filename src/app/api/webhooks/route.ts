import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Razorpay webhook — requires RAZORPAY_WEBHOOK_SECRET in .env.local
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    // Webhook not yet configured — reject to avoid silent data acceptance
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
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // TODO: Parse event type from JSON body and handle payment.captured, etc.
  return NextResponse.json({ received: true })
}
