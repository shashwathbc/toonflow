// POST /api/anime/watch — PUBLIC playback URL for a scene in a published project.
//
// The sibling route /api/anime/assets serves the OWNER their private drafts.
// This one serves the world, and the difference is entirely in what it checks:
//
//   /api/anime/assets  → is the caller the owner?
//   /api/anime/watch   → is the PROJECT published and public?
//
// No sign-in is required, because a published title is public content. What is
// deliberately NOT done is copying the video to a world-readable bucket path:
// keeping the bytes under `private/` and minting a short-lived signed URL per
// request means unpublishing REVOKES access immediately, on the very next
// request, rather than leaving a permanent download token in the wild that no
// amount of unpublishing can recall.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminBucket, adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { getClientIp, isSameOrigin } from '@/lib/views/botDetection'
import { saltedHash } from '@/lib/views/crypto'
import { PROJECTS_COLLECTION } from '@/lib/anime/jobs'

export const runtime = 'nodejs'

/**
 * Fifteen minutes — long enough to watch a scene through without a mid-playback
 * refresh, short enough that a copy-pasted URL stops working quickly.
 */
const SIGNED_URL_TTL_MS = 15 * 60 * 1000

const schema = z.object({
  projectId: z.string().min(1).max(128),
  sceneId: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  if (bodyTooLarge(request, 4 * 1024)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  // Same-origin only. This is an unauthenticated endpoint that hands out signed
  // URLs, so it exists to serve our own player — not to be a public CDN API
  // someone else can embed and hotlink from.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 403 })
  }

  // Per-IP ceiling: signing is cheap but not free, and an unauthenticated
  // endpoint has no account to rate-limit against.
  const { allowed } = await checkRateLimitAsync(`anime:watch:${saltedHash(getClientIp(request))}`, 180, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { projectId, sceneId } = parsed.data

  const db = adminDb()
  const [projectSnap, sceneSnap] = await Promise.all([
    db.collection(PROJECTS_COLLECTION).doc(projectId).get(),
    db.collection(PROJECTS_COLLECTION).doc(projectId).collection('scenes').doc(sceneId).get(),
  ])

  // Publication state is re-read on EVERY request — that is what makes
  // unpublishing take effect immediately.
  if (
    !projectSnap.exists ||
    projectSnap.get('status') !== 'published' ||
    projectSnap.get('visibility') === 'private'
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!sceneSnap.exists || sceneSnap.get('projectId') !== projectId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const storageKey = sceneSnap.get('storageKey') as string | null
  if (!storageKey || sceneSnap.get('status') !== 'ready') {
    return NextResponse.json({ error: 'That scene is not available.', code: 'not_generated' }, { status: 404 })
  }

  // The key must live under the PROJECT OWNER's private prefix. Without this a
  // corrupted scene document could aim the signer at any object in the bucket.
  const ownerId = projectSnap.get('ownerId') as string
  if (!storageKey.startsWith(`private/${ownerId}/`)) {
    console.error('[/api/anime/watch] refusing out-of-scope key', { projectId, sceneId })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const file = adminBucket().file(storageKey)
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: 'That scene is not available.', code: 'not_generated' }, { status: 404 })
    }
    const expires = Date.now() + SIGNED_URL_TTL_MS
    const [url] = await file.getSignedUrl({ action: 'read', expires })
    return NextResponse.json({ url, expiresAt: expires }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[/api/anime/watch] signing failed:', err)
    return NextResponse.json({ error: 'Could not load that scene. Please try again.' }, { status: 502 })
  }
}
