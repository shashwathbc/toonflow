// Rating aggregation — SERVER ONLY (audit finding M3). Clients used to write the
// content doc's `rating`/`ratingCount` aggregate themselves; the Firestore rules
// could only bound the SHAPE of that write (avg in [0,5], count ±1), not its
// truthfulness, so a scripted client could still nudge a rival's score. Moving
// the transaction behind the Admin SDK (which bypasses rules) — keyed to the
// VERIFIED uid — makes the aggregate tamper-proof, matching the view-count model.
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/serverApp'
import { verifiedUid } from '@/lib/auth/serverUser'
import { computeRatingUpdate } from '@/lib/engagement/ratingMath'

export const runtime = 'nodejs'

const schema = z.object({
  contentType: z.enum(['novel', 'webtoon']),
  contentId: z.string().min(1).max(200),
  value: z.number().int().min(1).max(5),
})

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { contentType, contentId, value } = parsed.data

  const db = adminDb()
  const ratingRef = db.doc(`ratings/${uid}_${contentType}_${contentId}`)
  const cRef = db.doc(`${contentType === 'novel' ? 'novels' : 'webtoons'}/${contentId}`)

  try {
    // Same running-average transaction as the old client path, now authoritative:
    // re-selecting the current star clears the rating, a new value adds it, a
    // changed value adjusts the sum. sum is reconstructed from avg*count.
    const result = await db.runTransaction(async (tx) => {
      const [rSnap, cSnap] = await Promise.all([tx.get(ratingRef), tx.get(cRef)])
      if (!cSnap.exists) return null

      const currentAvg = (cSnap.data()?.rating as number) ?? 0
      const currentCount = (cSnap.data()?.ratingCount as number) ?? 0
      const prev = rSnap.exists ? ((rSnap.data()?.value as number) ?? 0) : null

      const upd = computeRatingUpdate(currentAvg, currentCount, prev, value)

      if (upd.action === 'removed') {
        tx.delete(ratingRef)
      } else if (upd.action === 'changed') {
        tx.update(ratingRef, { value, updatedAt: FieldValue.serverTimestamp() })
      } else {
        tx.set(ratingRef, {
          uid,
          contentType,
          contentId,
          value,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      tx.update(cRef, { rating: upd.rating, ratingCount: upd.ratingCount })
      return { rating: upd.rating, ratingCount: upd.ratingCount, userRating: upd.userRating }
    })

    if (!result) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/ratings] Error:', err)
    return NextResponse.json({ error: 'Could not save your rating. Please try again.' }, { status: 502 })
  }
}
