import { NextRequest, NextResponse } from 'next/server'

// Payment webhook placeholder — Razorpay events will be handled here
export async function POST(request: NextRequest) {
  // TODO: Verify Razorpay webhook signature
  // const signature = request.headers.get('x-razorpay-signature')
  await request.text() // consume body to avoid hanging connections

  // Placeholder — return 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}
