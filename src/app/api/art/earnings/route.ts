// GET /api/art/earnings — a creator's marketplace earnings.
//
// Server-side because the ledger is server-only in firestore.rules: a creator
// may READ their own earnings but must never be able to write them, and the
// totals below are what a withdrawal is paid against.
//
// Scoped to the VERIFIED session uid — never a uid from the query string. That
// is the whole authorization decision, and putting it anywhere else (a filter
// the client supplies, say) would make one creator's balance readable by any
// other.
import { NextResponse, type NextRequest } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifiedUid } from '@/lib/auth/serverUser'
import { adminDb } from '@/lib/firebase/serverApp'
import { loadMarketplaceEconomics } from '@/lib/art/economics.server'
import type { EarningStatus } from '@/lib/art/orderLifecycle'

export const runtime = 'nodejs'

const EARNINGS = 'creatorEarnings'
/** A creator with more lines than this needs the paginated ledger view, not a
 *  summary endpoint that scans everything on every dashboard load. */
const MAX_LINES = 500

export interface ArtEarningsSummary {
  /** Lifetime gross across every non-reversed sale, in paise. */
  grossMinor: number
  /** Earned but not yet withdrawable — in the delivery/return hold. */
  pendingMinor: number
  /** Cleared and withdrawable now. */
  availableMinor: number
  /** Already swept into a completed withdrawal. */
  paidOutMinor: number
  /** Refunded, returned, cancelled or failed. Never payable. */
  reversedMinor: number
  orderCount: number
  unitsSold: number
  /** Days after delivery before earnings clear — shown next to the pending figure. */
  holdDays: number
  recent: {
    orderId: string
    productId: string
    productTitle: string
    quantity: number
    netMinor: number
    status: EarningStatus
    availableAt: string | null
    createdAt: string | null
  }[]
}

const toIso = (value: unknown): string | null =>
  value instanceof Timestamp ? value.toDate().toISOString() : null

export async function GET(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const economics = await loadMarketplaceEconomics()

  const snap = await adminDb()
    .collection(EARNINGS)
    .where('creatorId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(MAX_LINES)
    .get()

  const summary: ArtEarningsSummary = {
    grossMinor: 0,
    pendingMinor: 0,
    availableMinor: 0,
    paidOutMinor: 0,
    reversedMinor: 0,
    orderCount: 0,
    unitsSold: 0,
    holdDays: economics.earningsHoldDays,
    recent: [],
  }

  const orderIds = new Set<string>()

  for (const doc of snap.docs) {
    const status = doc.get('status') as EarningStatus
    const netMinor = (doc.get('netMinor') as number) ?? 0
    const quantity = (doc.get('quantity') as number) ?? 0

    switch (status) {
      case 'pending':
        summary.pendingMinor += netMinor
        break
      case 'available':
        summary.availableMinor += netMinor
        break
      case 'paid_out':
        summary.paidOutMinor += netMinor
        break
      case 'reversed':
        summary.reversedMinor += netMinor
        break
    }

    // A reversed line is not revenue and is excluded from gross and unit counts —
    // showing a refunded sale in "total earned" overstates what a creator made.
    if (status !== 'reversed') {
      summary.grossMinor += (doc.get('grossMinor') as number) ?? 0
      summary.unitsSold += quantity
      orderIds.add(doc.get('orderId') as string)
    }

    if (summary.recent.length < 25) {
      summary.recent.push({
        orderId: doc.get('orderId') as string,
        productId: doc.get('productId') as string,
        productTitle: (doc.get('productTitle') as string) ?? 'Product',
        quantity,
        netMinor,
        status,
        availableAt: toIso(doc.get('availableAt')),
        createdAt: toIso(doc.get('createdAt')),
      })
    }
  }

  summary.orderCount = orderIds.size

  return NextResponse.json(summary)
}
