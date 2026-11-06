// Server-side generation-job engine. SERVER ONLY (Admin SDK).
//
// A job is the single record of one asynchronous generation request. Clients can
// READ their own jobs (to drive progress UI) but never write them — otherwise a
// user could mark a job `completed`, point one at another user's project, or
// mint jobs past their quota. Every mutation in this file runs with the Admin
// SDK, keyed to a uid that came from a verified session cookie.
//
// Lifecycle:
//   queued → processing → completed
//                       ↘ failed
//   queued/processing   → cancelled
//
// There is no background worker: `advanceJob` is pulled by the status endpoint
// the client polls. That keeps the whole pipeline serverless-friendly while
// still being genuinely asynchronous — the HTTP request that starts a job never
// waits for the video.
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { adminBucket, adminDb } from '@/lib/firebase/serverApp'
import type { GenerationJob, GenerationJobStatus, GenerationSettings, SceneStatus } from '@/types/anime'
import { activeProvider, providerById } from './provider'
import type { ProviderError } from './provider/types'
import { tierLimits, type EntitlementTier } from './limits'

export const JOBS_COLLECTION = 'generationJobs'
export const PROJECTS_COLLECTION = 'animeProjects'

/** How long a job may sit in queued/processing before we call it timed out. */
const JOB_TIMEOUT_MS = 15 * 60 * 1000

/** Private object prefix. Storage rules deny ALL client access under `private/`. */
export function sceneStoragePath(uid: string, projectId: string, sceneId: string, ext = 'mp4'): string {
  return `private/${uid}/anime/${projectId}/${sceneId}/clip.${ext}`
}

export function posterStoragePath(uid: string, projectId: string, sceneId: string): string {
  return `private/${uid}/anime/${projectId}/${sceneId}/poster.jpg`
}

export interface QuotaVerdict {
  ok: boolean
  /** Machine-readable reason, surfaced to the client so the UI can explain. */
  code?: 'daily_quota' | 'concurrent_limit'
  message?: string
}

/**
 * Enforce the per-user daily job quota and the in-flight concurrency cap.
 *
 * Counted from the job collection itself rather than a separate counter, so it
 * cannot drift out of sync with reality and there is no counter for a client to
 * poison. Both queries are indexed (ownerId + createdAt, ownerId + status).
 */
export async function checkGenerationQuota(
  uid: string,
  tier: EntitlementTier,
  db: Firestore = adminDb(),
): Promise<QuotaVerdict> {
  const limits = tierLimits(tier)
  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000)

  const [dayCount, inflightCount] = await Promise.all([
    db
      .collection(JOBS_COLLECTION)
      .where('ownerId', '==', uid)
      .where('createdAt', '>=', since)
      .count()
      .get(),
    db
      .collection(JOBS_COLLECTION)
      .where('ownerId', '==', uid)
      .where('status', 'in', ['queued', 'processing'])
      .count()
      .get(),
  ])

  if (dayCount.data().count >= limits.dailyJobs) {
    return {
      ok: false,
      code: 'daily_quota',
      message: `You've used all ${limits.dailyJobs} generations for today. Your quota resets on a rolling 24-hour window.`,
    }
  }
  if (inflightCount.data().count >= limits.concurrentJobs) {
    return {
      ok: false,
      code: 'concurrent_limit',
      message: `You already have ${limits.concurrentJobs} generations running. Wait for one to finish, or cancel it.`,
    }
  }
  return { ok: true }
}

/**
 * Reject a resubmission of a request that is already in flight.
 *
 * Duplicate prevention is deliberately scoped to NON-TERMINAL jobs: re-running
 * the exact same prompt later is a legitimate thing to want (the vendor may be
 * non-deterministic, or the first attempt failed). What we block is the
 * double-click / retried-fetch case, which would otherwise cost a second
 * vendor call for a result the user is already waiting on.
 */
export async function findInFlightDuplicate(
  uid: string,
  requestHash: string,
  db: Firestore = adminDb(),
): Promise<string | null> {
  const snap = await db
    .collection(JOBS_COLLECTION)
    .where('ownerId', '==', uid)
    .where('requestHash', '==', requestHash)
    .where('status', 'in', ['queued', 'processing'])
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0].id
}

export interface CreateJobArgs {
  uid: string
  projectId: string
  sceneId: string
  settings: GenerationSettings
  requestHash: string
  intent: 'generate' | 'regenerate' | 'extend'
}

/**
 * Write the queued job record. Called only after auth, ownership, quota and
 * duplicate checks have passed AND a provider is known to be configured — we
 * never create a job we have no way to run.
 */
export async function createJob(args: CreateJobArgs, db: Firestore = adminDb()): Promise<string> {
  const provider = activeProvider()
  if (!provider) throw new Error('createJob called with no configured provider')

  const ref = db.collection(JOBS_COLLECTION).doc()
  await ref.set({
    ownerId: args.uid,
    projectId: args.projectId,
    sceneId: args.sceneId,
    provider: provider.id,
    providerJobId: null,
    status: 'queued' satisfies GenerationJobStatus,
    progress: 0,
    settings: args.settings,
    intent: args.intent,
    storageKey: null,
    error: null,
    requestHash: args.requestHash,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
  })

  // Point the scene at its new job and show it as queued straight away, so a
  // reload before the first poll still renders the right state.
  await sceneRef(db, args.projectId, args.sceneId).set(
    {
      generationJobId: ref.id,
      status: 'queued' satisfies SceneStatus,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return ref.id
}

function sceneRef(db: Firestore, projectId: string, sceneId: string) {
  return db.collection(PROJECTS_COLLECTION).doc(projectId).collection('scenes').doc(sceneId)
}

/** Persist a terminal failure on both the job and its scene. */
async function failJob(
  db: Firestore,
  jobId: string,
  job: Pick<GenerationJob, 'projectId' | 'sceneId'>,
  error: ProviderError,
): Promise<void> {
  const batch = db.batch()
  batch.set(
    db.collection(JOBS_COLLECTION).doc(jobId),
    {
      status: 'failed' satisfies GenerationJobStatus,
      error: { code: error.code, message: error.message },
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(
    sceneRef(db, job.projectId, job.sceneId),
    { status: 'failed' satisfies SceneStatus, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  await batch.commit()
}

export interface AdvanceResult {
  status: GenerationJobStatus
  progress: number
  error: { code: string; message: string } | null
}

/**
 * Move a job forward by one step: submit it if still queued, otherwise poll the
 * vendor. Idempotent and safe to call from concurrent pollers — the worst case
 * is a duplicate status read, never a duplicate submission (the `queued →
 * processing` flip is a guarded transaction).
 */
export async function advanceJob(jobId: string, db: Firestore = adminDb()): Promise<AdvanceResult> {
  const ref = db.collection(JOBS_COLLECTION).doc(jobId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('job not found')
  const job = snap.data() as GenerationJob

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { status: job.status, progress: job.progress, error: job.error }
  }

  const provider = providerById(job.provider)
  if (!provider) {
    // The provider that accepted this job is gone or lost its credentials. That
    // is unrecoverable for this job — fail it honestly rather than leaving the
    // user watching a spinner forever.
    const error: ProviderError = {
      code: 'provider_not_configured',
      message: 'The video generation service is no longer available. Please try again later.',
      retryable: true,
    }
    await failJob(db, jobId, job, error)
    return { status: 'failed', progress: job.progress, error }
  }

  // Watchdog: a job that never reached a terminal state within the window is
  // treated as timed out, so nothing can occupy a concurrency slot forever.
  const createdMs = (job.createdAt as unknown as Timestamp)?.toMillis?.() ?? Date.now()
  if (Date.now() - createdMs > JOB_TIMEOUT_MS) {
    const error: ProviderError = {
      code: 'timeout',
      message: 'Generation took too long and was stopped. You can try again.',
      retryable: true,
    }
    if (job.providerJobId) await provider.cancel(job.providerJobId).catch(() => false)
    await failJob(db, jobId, job, error)
    return { status: 'failed', progress: job.progress, error }
  }

  // ── Submit ────────────────────────────────────────────────
  if (job.status === 'queued') {
    // Claim the job first. If a concurrent poller already flipped it, back off
    // and let that one do the submission — this is what stops a double submit.
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref)
      if ((fresh.get('status') as GenerationJobStatus) !== 'queued') return false
      tx.update(ref, { status: 'processing', updatedAt: FieldValue.serverTimestamp() })
      return true
    })
    if (!claimed) {
      const again = await ref.get()
      return {
        status: (again.get('status') as GenerationJobStatus) ?? 'processing',
        progress: (again.get('progress') as number) ?? 0,
        error: (again.get('error') as AdvanceResult['error']) ?? null,
      }
    }

    const submission = await submitToProvider(db, jobId, job, provider)
    if (!submission.ok) {
      await failJob(db, jobId, job, submission.error)
      return { status: 'failed', progress: 0, error: submission.error }
    }
    await ref.set(
      {
        providerJobId: submission.providerJobId,
        progress: submission.progress ?? 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await sceneRef(db, job.projectId, job.sceneId).set(
      { status: 'processing' satisfies SceneStatus, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    return { status: 'processing', progress: submission.progress ?? 0, error: null }
  }

  // ── Poll ──────────────────────────────────────────────────
  if (!job.providerJobId) {
    // processing with no vendor handle means the submission write was lost.
    const error: ProviderError = {
      code: 'provider_unavailable',
      message: 'Generation could not be tracked. Please try again.',
      retryable: true,
    }
    await failJob(db, jobId, job, error)
    return { status: 'failed', progress: 0, error }
  }

  const poll = await provider.poll(job.providerJobId)
  if (!poll.ok) {
    await failJob(db, jobId, job, poll.error)
    return { status: 'failed', progress: job.progress, error: poll.error }
  }

  if (poll.status === 'processing') {
    const progress = Math.max(0, Math.min(99, Math.round(poll.progress)))
    await ref.set({ progress, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return { status: 'processing', progress, error: null }
  }

  // ── Completed: persist the bytes before believing the vendor ──
  try {
    const storageKey = await storeCompletedVideo(job, poll)
    const batch = db.batch()
    batch.set(
      ref,
      {
        status: 'completed' satisfies GenerationJobStatus,
        progress: 100,
        storageKey,
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    batch.set(
      sceneRef(db, job.projectId, job.sceneId),
      {
        status: 'ready' satisfies SceneStatus,
        storageKey,
        durationSec: Math.max(0, poll.durationSec),
        metadata: poll.metadata ?? {},
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await batch.commit()
    return { status: 'completed', progress: 100, error: null }
  } catch (err) {
    console.error('[anime/jobs] failed to store completed video:', err)
    const error: ProviderError = {
      code: 'corrupted_output',
      message: 'The generated video could not be saved. Please try again.',
      retryable: true,
    }
    await failJob(db, jobId, job, error)
    return { status: 'failed', progress: job.progress, error }
  }
}

/** Compose the vendor prompt from stored data and hand the job over. */
async function submitToProvider(
  db: Firestore,
  jobId: string,
  job: GenerationJob,
  provider: NonNullable<ReturnType<typeof providerById>>,
) {
  const { composePrompt } = await import('./promptBuilder')
  const { frameSize } = await import('./presets')

  // Characters are re-read SERVER-SIDE from the owner's own collection. The
  // client sends ids only, so it can neither inject arbitrary prompt text
  // through a character body nor reference someone else's character.
  const characters = await loadOwnedCharacters(db, job.ownerId, job.settings.characterIds)
  const composed = composePrompt(job.settings, characters)
  const { width, height } = frameSize(job.settings.aspectRatio, job.settings.resolution)

  return provider.submit({
    jobId,
    prompt: composed.prompt,
    negativePrompt: composed.negativePrompt,
    settings: job.settings,
    width,
    height,
    referenceImageUrls: characters.flatMap((c) => c.referenceImages).slice(0, 8),
  })
}

async function loadOwnedCharacters(db: Firestore, uid: string, ids: string[]) {
  if (ids.length === 0) return []
  const docs = await Promise.all(
    ids.slice(0, 8).map((id) => db.collection('animeCharacters').doc(id).get()),
  )
  return docs
    .filter((d) => d.exists && d.get('ownerId') === uid)
    .map((d) => ({ id: d.id, ...d.data() }) as import('@/types/anime').AnimeCharacter)
}

/**
 * Write the finished clip into PRIVATE storage. Providers may hand back bytes or
 * a URL; either way the bytes end up in our bucket, so playback never depends on
 * a vendor URL that could expire, change, or leak the vendor account.
 */
async function storeCompletedVideo(
  job: GenerationJob,
  poll: Extract<Awaited<ReturnType<NonNullable<ReturnType<typeof providerById>>['poll']>>, { status: 'completed' }>,
): Promise<string> {
  let bytes: Buffer
  let contentType = 'video/mp4'

  if (poll.video.kind === 'bytes') {
    bytes = Buffer.from(poll.video.data)
    contentType = poll.video.contentType || contentType
  } else {
    const res = await fetch(poll.video.url)
    if (!res.ok) throw new Error(`provider asset fetch failed: ${res.status}`)
    const type = res.headers.get('content-type') ?? ''
    // Refuse anything that isn't a video — a vendor handing back an HTML error
    // page must fail loudly, not get stored and served as a "clip".
    if (!type.startsWith('video/')) throw new Error(`unexpected asset content-type: ${type}`)
    contentType = type
    bytes = Buffer.from(await res.arrayBuffer())
  }

  if (bytes.byteLength === 0) throw new Error('provider returned an empty asset')

  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  const key = sceneStoragePath(job.ownerId, job.projectId, job.sceneId, ext)
  await adminBucket().file(key).save(bytes, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=0, no-store' },
  })
  return key
}

/** Owner-initiated cancellation. Best-effort at the vendor, authoritative here. */
export async function cancelJob(jobId: string, uid: string, db: Firestore = adminDb()): Promise<boolean> {
  const ref = db.collection(JOBS_COLLECTION).doc(jobId)
  const snap = await ref.get()
  if (!snap.exists) return false
  const job = snap.data() as GenerationJob
  if (job.ownerId !== uid) return false
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return false

  if (job.providerJobId) {
    const provider = providerById(job.provider)
    await provider?.cancel(job.providerJobId).catch(() => false)
  }

  const batch = db.batch()
  batch.set(
    ref,
    {
      status: 'cancelled' satisfies GenerationJobStatus,
      error: { code: 'cancelled', message: 'Generation cancelled.' },
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(
    sceneRef(db, job.projectId, job.sceneId),
    { status: 'idle' satisfies SceneStatus, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  await batch.commit()
  return true
}
