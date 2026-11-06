// GET    /api/anime/jobs/[jobId] — poll (and advance) one generation job.
// DELETE /api/anime/jobs/[jobId] — cancel it.
//
// Polling is also what DRIVES the pipeline: with no queue worker in a serverless
// deployment, `advanceJob` submits a queued job or asks the vendor where a
// processing one is. That keeps the architecture genuinely asynchronous (the
// submit request never waits for a video) without needing infrastructure the
// project doesn't have.
//
// Every read is ownership-checked here as well as by the Firestore rules — the
// rules protect the direct client listener, this protects the route.
import { NextResponse, type NextRequest } from 'next/server'
import { verifiedUid } from '@/lib/auth/serverUser'
import { adminDb } from '@/lib/firebase/serverApp'
import { advanceJob, cancelJob, JOBS_COLLECTION } from '@/lib/anime/jobs'
import { checkRateLimitAsync } from '@/lib/views/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Polling is cheap but not free — one job may be polled ~2×/s at most. */
const POLL_LIMIT = 240
const POLL_WINDOW_MS = 60_000

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { jobId } = await context.params
  if (!jobId || jobId.length > 128) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { allowed } = await checkRateLimitAsync(`anime:poll:${uid}`, POLL_LIMIT, POLL_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json({ error: 'Slow down — too many status checks.' }, { status: 429 })
  }

  const db = adminDb()
  const snap = await db.collection(JOBS_COLLECTION).doc(jobId).get()
  if (!snap.exists || snap.get('ownerId') !== uid) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  try {
    const result = await advanceJob(jobId, db)
    return NextResponse.json(
      {
        jobId,
        status: result.status,
        progress: result.progress,
        error: result.error,
        sceneId: snap.get('sceneId') as string,
        projectId: snap.get('projectId') as string,
      },
      // Job state changes constantly — never let a CDN or the browser cache it.
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[/api/anime/jobs/[jobId]] advance failed:', err)
    return NextResponse.json({ error: 'Could not read generation status.' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const uid = await verifiedUid(request)
  if (!uid) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { jobId } = await context.params
  if (!jobId || jobId.length > 128) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  // cancelJob re-checks ownership itself, so this can't cancel someone else's
  // work even if the id is guessed.
  const cancelled = await cancelJob(jobId, uid)
  if (!cancelled) {
    return NextResponse.json({ error: 'That job can no longer be cancelled.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
