// POST /api/art/view — record one marketplace listing view.
//
// Written with the Admin SDK because firestore.rules denies clients any write to
// viewCount: a counter a client can increment is a counter that means nothing,
// and these numbers rank listings and shape what buyers see.
//
// Dedup is a per-day document keyed by a SALTED HASH of the visitor's IP + the
// listing id. The raw IP is never stored — only its HMAC, using the same
// primitive the chapter/episode view pipeline already relies on.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '@/lib/firebase/serverApp'
import { bodyTooLarge } from '@/lib/api/guard'
import { detectBot, getClientIp, isSameOrigin } from '@/lib/views/botDetection'
import { saltedHash } from '@/lib/views/crypto'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'

export const runtime = 'nodejs'

const schema = z.object({
  kind: z.enum(['artwork', 'product']),
  id: z.string().min(1).max(128),
})

/** Listing kind → its collection. Keeps the id space explicit, not guessed. */
const COLLECTION: Record<'artwork' | 'product', string> = {
  artwork: 'artworks',
  product: 'products',
}

/** Dedup window — one counted view per visitor per listing per day. */
const DEDUP_TTL_HOURS = 24

export async function POST(request: NextRequest) {
  if (bodyTooLarge(request, 2 * 1024)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  // Same-origin only: this endpoint exists to serve our own pages, and allowing
  // cross-origin calls would turn it into a public counter-bumping API.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ counted: false }, { status: 403 })
  }

  // Crawlers and headless agents are not readers. Silently not counting is the
  // right answer — a 4xx would just teach a scraper to retry differently.
  if (detectBot(request).isBot) {
    return NextResponse.json({ counted: false })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { kind, id } = parsed.data

  const ip = getClientIp(request)
  const { allowed } = await checkRateLimitAsync(`art:view:${saltedHash(ip)}`, 120, 60_000)
  if (!allowed) return NextResponse.json({ counted: false }, { status: 429 })

  const collection = COLLECTION[kind]
  const day = new Date().toISOString().slice(0, 10)
  const dedupId = saltedHash(`${ip}:${collection}:${id}:${day}`)

  const db = adminDb()
  const dedupRef = db.collection('artViewDedup').doc(dedupId)
  const targetRef = db.collection(collection).doc(id)

  try {
    const counted = await db.runTransaction(async (tx) => {
      const [dedupSnap, targetSnap] = await Promise.all([tx.get(dedupRef), tx.get(targetRef)])
      // Only count views of listings that are actually published — otherwise a
      // creator could inflate a draft before it goes live.
      if (!targetSnap.exists || targetSnap.get('status') !== 'published') return false
      if (dedupSnap.exists) return false
      tx.set(dedupRef, {
        createdAt: FieldValue.serverTimestamp(),
        // A TTL policy on this field lets Firestore expire these records
        // automatically; without one the collection grows unbounded.
        expiresAt: new Date(Date.now() + DEDUP_TTL_HOURS * 60 * 60 * 1000),
      })
      tx.update(targetRef, { viewCount: FieldValue.increment(1) })
      return true
    })
    return NextResponse.json({ counted })
  } catch (err) {
    console.error('[/api/art/view] failed:', err)
    // A view that fails to record is not worth surfacing to the reader.
    return NextResponse.json({ counted: false })
  }
}
