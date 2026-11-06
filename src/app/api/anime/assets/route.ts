// POST /api/anime/assets — mint a short-lived signed URL for a private clip.
//
// Generated video lives under `private/{uid}/…`, which the Storage rules deny to
// every client including its owner. The ONLY way to play it is this route:
//
//   authenticated request → server-side ownership check → signed temporary URL
//
// That is what keeps a draft private in practice rather than by obscurity. A
// Firebase download token, by contrast, is permanent and bearer-only: anyone who
// ever saw the URL keeps access forever, and revoking means re-uploading. A
// signed URL expires on its own.
import { NextResponse, type NextRequest } from 'next/server'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminBucket, adminDb } from '@/lib/firebase/serverApp'
import { signAssetSchema } from '@/lib/anime/schema'
import { PROJECTS_COLLECTION } from '@/lib/anime/jobs'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'

export const runtime = 'nodejs'

/**
 * Ten minutes: long enough to start playback and scrub, short enough that a
 * leaked URL (shared screenshot, referrer, chat paste) stops working quickly.
 */
const SIGNED_URL_TTL_MS = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (bodyTooLarge(request, 4 * 1024)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`anime:sign:${uid}`, 300, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = signAssetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { projectId, sceneId, kind } = parsed.data

  const db = adminDb()
  const sceneSnap = await db
    .collection(PROJECTS_COLLECTION)
    .doc(projectId)
    .collection('scenes')
    .doc(sceneId)
    .get()

  if (!sceneSnap.exists || sceneSnap.get('ownerId') !== uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const storageKey = (kind === 'poster' ? sceneSnap.get('posterKey') : sceneSnap.get('storageKey')) as
    | string
    | null
  if (!storageKey) {
    // Nothing has been generated — say so honestly rather than returning a URL
    // that would 404 and look like a broken player.
    return NextResponse.json({ error: 'This scene has not been generated yet.', code: 'not_generated' }, { status: 404 })
  }

  // Belt and braces: the key must live under THIS user's private prefix. Even if
  // a bad write ever put a foreign key on a scene, this refuses to sign it.
  if (!storageKey.startsWith(`private/${uid}/`)) {
    console.error('[/api/anime/assets] refusing to sign out-of-scope key', { uid, storageKey })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const file = adminBucket().file(storageKey)
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: 'This scene has not been generated yet.', code: 'not_generated' }, { status: 404 })
    }
    const expires = Date.now() + SIGNED_URL_TTL_MS
    const [url] = await file.getSignedUrl({ action: 'read', expires })
    return NextResponse.json(
      { url, expiresAt: expires },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[/api/anime/assets] signing failed:', err)
    return NextResponse.json({ error: 'Could not load that clip. Please try again.' }, { status: 502 })
  }
}
