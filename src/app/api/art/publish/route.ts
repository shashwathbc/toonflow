// POST /api/art/publish — take a draft artwork public (or pull it back).
//
// Publishing is the moment private content becomes world-readable, so it is the
// right place for the expensive checks that would be wasteful on every draft
// save. The route does something the Storage rules structurally cannot: it
// re-reads the STORED BYTES with the Admin SDK and re-identifies the file from
// its magic bytes.
//
// Why that matters: Storage rules can only see the `contentType` the uploader
// declared. A client that sets `contentType: image/png` while uploading an HTML
// document passes the rules — the rules have no way to look inside the object.
// Sniffing the real container here is what closes that gap, and it happens
// before the asset is ever linked from a public page.
//
// Counters (viewCount/likeCount) and status are refused to clients by
// firestore.rules, so `published` can only ever be set from here.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminBucket, adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { publishArtworkSchema } from '@/lib/art/schema'
import { sniffMime, ACCEPTED_RASTER_MIME, MAX_ARTWORK_BYTES } from '@/lib/art/validation'
import { screenContent } from '@/lib/ai/moderation'
import { ARTWORKS } from '@/lib/firebase/art'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BODY_BYTES = 16 * 1024
/** Enough bytes to identify every container we accept. */
const SNIFF_BYTES = 64

/**
 * Resolve the object path for an artwork's public render. Accepts either a
 * stored object path or a Firebase download URL (which carries the path,
 * percent-encoded, after `/o/`).
 */
function objectPathFrom(value: string): string | null {
  if (!value.startsWith('http')) return value
  const match = value.match(/\/o\/([^?]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`art:publish:${uid}`, 30, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "You've published a lot recently. Please try again shortly." }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const db = adminDb()

  // ── Unpublish ─────────────────────────────────────────────
  if (body.action === 'unpublish') {
    const artworkId = typeof body.artworkId === 'string' ? body.artworkId : ''
    if (!artworkId || artworkId.length > 128) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const ref = db.collection(ARTWORKS).doc(artworkId)
    const snap = await ref.get()
    if (!snap.exists || snap.get('ownerId') !== uid) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }
    await ref.update({
      status: 'draft',
      visibility: 'private',
      updatedAt: FieldValue.serverTimestamp(),
    })
    // Any product built on it must come down too — otherwise the marketplace
    // would keep selling a design the creator has withdrawn.
    const products = await db
      .collection('products')
      .where('ownerId', '==', uid)
      .where('artworkId', '==', artworkId)
      .where('status', '==', 'published')
      .limit(50)
      .get()
    if (!products.empty) {
      const batch = db.batch()
      products.docs.forEach((doc) =>
        batch.update(doc.ref, { status: 'unavailable', updatedAt: FieldValue.serverTimestamp() }),
      )
      await batch.commit()
    }
    return NextResponse.json({ ok: true, status: 'draft', productsWithdrawn: products.size })
  }

  // ── Publish ───────────────────────────────────────────────
  const parsed = publishArtworkSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const message =
      issue?.path?.[0] === 'rightsConfirmed'
        ? 'Please confirm you own the rights to this artwork.'
        : (issue?.message ?? 'Invalid request')
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { artworkId, title, description, category, tags, visibility } = parsed.data

  const ref = db.collection(ARTWORKS).doc(artworkId)
  const snap = await ref.get()
  if (!snap.exists || snap.get('ownerId') !== uid) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  // Text that will appear on a public page.
  if (!screenContent(`${title} ${description} ${tags.join(' ')}`).ok) {
    return NextResponse.json({ error: 'This listing was blocked by our content policy.' }, { status: 422 })
  }

  const imageURL = snap.get('imageURL') as string | null
  if (!imageURL) {
    return NextResponse.json(
      { error: 'Add or render the artwork image before publishing.', code: 'no_image' },
      { status: 400 },
    )
  }

  // ── Server-side file verification ─────────────────────────
  const objectPath = objectPathFrom(imageURL)
  if (!objectPath || !objectPath.startsWith(`artworks/${uid}/`)) {
    // The public render must live under this creator's own prefix. Anything else
    // means the document points somewhere it has no business pointing.
    return NextResponse.json({ error: 'That artwork file could not be verified.' }, { status: 400 })
  }

  try {
    const file = adminBucket().file(objectPath)
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: 'The artwork file is missing. Please re-upload it.' }, { status: 400 })
    }

    const [metadata] = await file.getMetadata()
    const size = Number(metadata.size ?? 0)
    if (!Number.isFinite(size) || size === 0) {
      return NextResponse.json({ error: 'The artwork file is empty. Please re-upload it.' }, { status: 400 })
    }
    if (size > MAX_ARTWORK_BYTES) {
      return NextResponse.json({ error: 'That artwork is larger than the 25 MB limit.' }, { status: 413 })
    }

    // Read only the header — enough to identify the container, cheap at any size.
    const [head] = await file.download({ start: 0, end: SNIFF_BYTES - 1 })
    const detected = sniffMime(new Uint8Array(head))
    if (!detected || !(ACCEPTED_RASTER_MIME as readonly string[]).includes(detected)) {
      console.warn('[/api/art/publish] rejected non-raster artwork', { uid, artworkId, detected })
      return NextResponse.json(
        { error: 'That file is not a valid PNG, JPG or WebP image. Please re-export and upload it again.' },
        { status: 422 },
      )
    }

    await ref.update({
      title,
      description,
      category,
      tags,
      visibility,
      rightsConfirmed: true,
      mimeType: detected,
      sizeBytes: size,
      status: 'published',
      publishedAt: snap.get('publishedAt') ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, artworkId, status: 'published' })
  } catch (err) {
    console.error('[/api/art/publish] verification failed:', err)
    return NextResponse.json({ error: 'Could not publish right now. Please try again.' }, { status: 502 })
  }
}
