// Recompute a novel's / webtoon's total viewCount from its chapters/episodes.
//
// Why this exists: /api/views increments the part AND the parent in one
// transaction, so the parent total is exactly the sum of its parts — until a
// part is DELETED. `deleteChapter`/`deleteEpisode` remove the child document and
// its views with it, but the parent keeps them: the total then permanently
// exceeds the sum of the chapters a reader can actually see on the detail page,
// and (because /api/creator/analytics prices payouts off that same field) the
// deleted content keeps earning.
//
// The client can't repair this itself — the Firestore rules deny every client
// write to viewCount (that's the whole point of the server-managed model), so
// the correction has to run here on the Admin SDK, keyed to the VERIFIED uid.
//
// This is a recomputation, not an adjustment: it can only ever set the parent to
// the sum of its surviving parts, so a caller who spams it changes nothing.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/serverApp'
import { verifiedUid } from '@/lib/auth/serverUser'

export const runtime = 'nodejs'

const schema = z.object({
  contentType: z.enum(['novel', 'webtoon']),
  contentId: z.string().min(1).max(200),
})

const SHAPE = {
  novel: { collection: 'novels', parts: 'chapters' },
  webtoon: { collection: 'webtoons', parts: 'episodes' },
} as const

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { collection, parts } = SHAPE[parsed.data.contentType]
  const db = adminDb()
  const parentRef = db.doc(`${collection}/${parsed.data.contentId}`)

  try {
    const parentSnap = await parentRef.get()
    if (!parentSnap.exists) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Owner or admin only. Not a security boundary on the VALUE (the recomputed
    // number is derived, not supplied) but this reads a whole subcollection, so
    // it stays behind the same ownership gate as the studio itself.
    if (parentSnap.get('authorId') !== uid) {
      const role = (await db.doc(`users/${uid}`).get()).get('role')
      if (role !== 'admin' && role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // `select` keeps this to the counter field — the panels/content payloads of a
    // long series are far too big to pull just to add up a column.
    const partSnaps = await parentRef.collection(parts).select('viewCount').get()
    const total = partSnaps.docs.reduce((sum, d) => {
      const v = d.get('viewCount')
      return sum + (typeof v === 'number' ? v : 0)
    }, 0)

    const previous = parentSnap.get('viewCount')
    const changed = previous !== total
    if (changed) await parentRef.update({ viewCount: total })

    return NextResponse.json({
      viewCount: total,
      previous: typeof previous === 'number' ? previous : 0,
      parts: partSnaps.size,
      changed,
    })
  } catch (err) {
    console.error('[views] reconcile failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
