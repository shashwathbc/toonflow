// POST /api/anime/publish — take an anime project into the public catalog,
// or pull it back out.
//
// This is server-side for the same reason /api/art/publish is: publishing is the
// moment private work becomes world-readable, and here it also makes the
// project's CLIPS publicly playable (via /api/anime/watch). A client-settable
// `status` would route straight around the checks below, so firestore.rules
// refuses status/visibility/publishedAt from clients entirely.
//
// The substantive gate is `hasPlayableScene`. A published project that contains
// no generated video would appear in Browse, Home and Originals as a real title
// and then play nothing — the exact "looks finished, isn't" failure this build
// avoids everywhere else.
import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { adminDb } from '@/lib/firebase/serverApp'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'
import { screenContent } from '@/lib/ai/moderation'
import { PROJECTS_COLLECTION } from '@/lib/anime/jobs'
import { HARD_LIMITS } from '@/lib/anime/limits'
import { GENRES } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16 * 1024

const publishSchema = z.object({
  projectId: z.string().min(1).max(128),
  title: z.string().trim().min(2).max(HARD_LIMITS.titleMaxChars),
  description: z.string().trim().max(HARD_LIMITS.descriptionMaxChars).default(''),
  genres: z
    .array(z.enum(GENRES as unknown as [string, ...string[]]))
    .min(1, 'Pick at least one genre')
    .max(5)
    .transform((list) => Array.from(new Set(list))),
  visibility: z.enum(['public', 'unlisted']).default('public'),
  /** Creator confirms the work is theirs — same contract as artwork publishing. */
  rightsConfirmed: z.literal(true),
})

const unpublishSchema = z.object({
  projectId: z.string().min(1).max(128),
  action: z.literal('unpublish'),
})

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  const { allowed } = await checkRateLimitAsync(`anime:publish:${uid}`, 30, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "You've published a lot recently. Try again shortly." }, { status: 429 })
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
    const parsed = unpublishSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const ref = db.collection(PROJECTS_COLLECTION).doc(parsed.data.projectId)
    const snap = await ref.get()
    if (!snap.exists || snap.get('ownerId') !== uid) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    // Flipping status back to draft is what revokes public playback: every
    // /api/anime/watch request re-checks it, so access ends immediately rather
    // than when some cached URL happens to expire.
    await ref.update({
      status: 'draft',
      visibility: 'private',
      updatedAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true, status: 'draft' })
  }

  // ── Publish ───────────────────────────────────────────────
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const message =
      issue?.path?.[0] === 'rightsConfirmed'
        ? 'Please confirm this is your work before publishing.'
        : (issue?.message ?? 'Invalid request')
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { projectId, title, description, genres, visibility } = parsed.data

  const ref = db.collection(PROJECTS_COLLECTION).doc(projectId)
  const snap = await ref.get()
  if (!snap.exists || snap.get('ownerId') !== uid) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Text that will appear on a public catalog page.
  if (!screenContent(`${title} ${description}`).ok) {
    return NextResponse.json({ error: 'This listing was blocked by our content policy.' }, { status: 422 })
  }

  // ── Must actually contain video ───────────────────────────
  const readyScenes = await ref
    .collection('scenes')
    .where('status', '==', 'ready')
    .limit(1)
    .get()

  const playable = readyScenes.docs.find((doc) => typeof doc.get('storageKey') === 'string')
  if (!playable) {
    return NextResponse.json(
      {
        error:
          'Generate at least one scene before publishing — a published title has to actually play something.',
        code: 'no_playable_scene',
      },
      { status: 400 },
    )
  }

  // The catalog cover. Falls back to the project's own thumbnail if a poster
  // frame was promoted earlier; either way a published project always has one.
  const thumbnailURL = (snap.get('thumbnailURL') as string | null) ?? null

  const userSnap = await db.collection('users').doc(uid).get()

  await ref.update({
    title,
    description,
    genres,
    visibility,
    status: 'published',
    // Denormalized so catalog cards don't need a second read per item, exactly
    // as novels/webtoons do.
    ownerName: (userSnap.get('displayName') as string) ?? 'Creator',
    ownerPhotoURL: (userSnap.get('photoURL') as string | null) ?? null,
    thumbnailURL,
    publishedAt: snap.get('publishedAt') ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ ok: true, projectId, status: 'published' })
}
