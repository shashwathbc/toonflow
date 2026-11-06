// POST /api/anime/jobs — submit one scene for AI video generation.
//
// This is the most abuse-sensitive endpoint on the platform: it spends real
// vendor money on demand. Every gate below is server-side and ordered cheapest-
// first, so a hostile caller is rejected before anything costly happens:
//
//   1. verified session cookie      → who is calling (never body.userId)
//   2. body size + zod              → the request is even well-formed
//   3. per-user hourly rate limit   → burst control
//   4. project + scene OWNERSHIP    → IDOR: you may only generate into your own
//   5. entitlement (tier) ceilings  → duration/resolution can't be inflated
//   6. daily quota + concurrency    → sustained-volume control
//   7. duplicate detection          → double-click doesn't double-spend
//   8. content moderation           → prohibited prompts never reach the vendor
//   9. provider configured?         → no provider, no job (never a fake one)
//  10. global budget + kill switch  → platform-wide blast radius
//
// The response returns immediately with a queued job id. Nothing here waits for
// a video: progress is polled from /api/anime/jobs/[jobId].
import { NextResponse, type NextRequest } from 'next/server'
import { verifiedUid } from '@/lib/auth/serverUser'
import { bodyTooLarge } from '@/lib/api/guard'
import { aiRateLimited } from '@/lib/api/aiRateLimit'
import { enforceGlobalAiBudget } from '@/lib/api/spendGuard'
import { adminDb } from '@/lib/firebase/serverApp'
import { resolveTier } from '@/lib/auth/entitlements'
import { createJobSchema } from '@/lib/anime/schema'
import { checkGenerationQuota, createJob, findInFlightDuplicate, PROJECTS_COLLECTION } from '@/lib/anime/jobs'
import { requestFingerprint } from '@/lib/anime/promptBuilder'
import { resolutionAllowed, tierLimits } from '@/lib/anime/limits'
import { activeProvider } from '@/lib/anime/provider'
import { screenContent } from '@/lib/ai/moderation'
import type { GenerationSettings } from '@/types/anime'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 24 * 1024

export async function POST(request: NextRequest) {
  const uid = await verifiedUid(request)
  if (!uid) {
    return NextResponse.json({ error: 'Authentication required — please sign in again' }, { status: 401 })
  }

  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid generation request' },
      { status: 400 },
    )
  }
  const { projectId, sceneId, settings, intent } = parsed.data

  const limited = await aiRateLimited(uid, 'video')
  if (limited) return limited

  const db = adminDb()

  // ── Ownership (IDOR) ──────────────────────────────────────
  // Both documents are checked, and both must belong to the CALLER. Checking
  // only the project would let someone generate into a scene id they guessed
  // from another project; checking only the scene would miss a scene whose
  // parent was transferred. `ownerId` is written by the rules-enforced create
  // path, so it is a trustworthy anchor.
  const [projectSnap, sceneSnap] = await Promise.all([
    db.collection(PROJECTS_COLLECTION).doc(projectId).get(),
    db.collection(PROJECTS_COLLECTION).doc(projectId).collection('scenes').doc(sceneId).get(),
  ])
  if (!projectSnap.exists || projectSnap.get('ownerId') !== uid) {
    // Deliberately the same 404 an unknown project gets — a distinct 403 would
    // confirm that someone else's project id exists.
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (!sceneSnap.exists || sceneSnap.get('ownerId') !== uid) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }

  // ── Entitlement ceilings ──────────────────────────────────
  const tier = await resolveTier(uid)
  const limits = tierLimits(tier)
  if (settings.durationSec > limits.maxDurationSec) {
    return NextResponse.json(
      {
        error: `Your plan allows clips up to ${limits.maxDurationSec}s. Shorten the clip and try again.`,
        code: 'duration_limit',
      },
      { status: 403 },
    )
  }
  if (!resolutionAllowed(tier, settings.resolution)) {
    return NextResponse.json(
      { error: `Your plan allows up to ${limits.maxResolution}. Lower the resolution and try again.`, code: 'resolution_limit' },
      { status: 403 },
    )
  }
  if (settings.characterIds.length > 0) {
    // Characters are prompt input, so referencing one you don't own would let
    // you read another creator's character sheet through generated output.
    const owned = await Promise.all(
      settings.characterIds.map((id) => db.collection('animeCharacters').doc(id).get()),
    )
    if (owned.some((snap) => !snap.exists || snap.get('ownerId') !== uid)) {
      return NextResponse.json({ error: 'One of those characters is unavailable' }, { status: 403 })
    }
  }

  // ── Volume controls ───────────────────────────────────────
  const quota = await checkGenerationQuota(uid, tier, db)
  if (!quota.ok) {
    return NextResponse.json({ error: quota.message, code: quota.code }, { status: 429 })
  }

  const requestHash = requestFingerprint(sceneId, settings as GenerationSettings)
  const duplicate = await findInFlightDuplicate(uid, requestHash, db)
  if (duplicate) {
    // Not an error — hand back the job they're already waiting on so the client
    // simply attaches to it. 200, because the desired end state is satisfied.
    return NextResponse.json({ jobId: duplicate, duplicate: true }, { status: 200 })
  }

  // ── Content policy ────────────────────────────────────────
  const screened = screenContent(`${settings.prompt} ${settings.negativePrompt}`)
  if (!screened.ok) {
    return NextResponse.json(
      { error: 'This request was blocked by our content policy.', code: 'blocked' },
      { status: 422 },
    )
  }

  // ── Integration boundary ──────────────────────────────────
  // No provider means no video, and we say so instead of queuing work that can
  // never run or writing a placeholder clip.
  if (!activeProvider()) {
    return NextResponse.json(
      {
        error:
          'AI video generation is not connected yet. Everything else in the Anime Studio works — scenes, characters, storyboards and the editor — and generation will light up the moment a provider is configured.',
        code: 'provider_not_configured',
      },
      { status: 503 },
    )
  }

  // Platform-wide kill switch + daily ceiling (cross-instance).
  const budget = await enforceGlobalAiBudget('image')
  if (budget) return budget

  try {
    const jobId = await createJob(
      { uid, projectId, sceneId, settings: settings as GenerationSettings, requestHash, intent },
      db,
    )
    return NextResponse.json({ jobId, duplicate: false }, { status: 202 })
  } catch (err) {
    console.error('[/api/anime/jobs] failed to create job:', err)
    return NextResponse.json({ error: 'Could not start generation. Please try again.' }, { status: 502 })
  }
}
