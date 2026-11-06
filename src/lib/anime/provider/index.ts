// Provider registry — resolves which AI video vendor (if any) handles a job.
//
// ═══════════════ INTEGRATION BOUNDARY ═══════════════
// No AI video provider ships with this repository. Everything up to and
// including the vendor call is built — auth, quotas, job records, storage,
// signed playback, progress, cancellation, retries — but the vendor itself is
// deliberately not stubbed, because a stub that returns a fake "completed" job
// would be indistinguishable from a real one to every layer above it.
//
// To connect one:
//   1. Implement `VideoProvider` (see ./types) in `./providers/<vendor>.ts`.
//   2. Register it in PROVIDERS below.
//   3. Set VIDEO_PROVIDER=<id> plus that provider's credentials as SERVER-SIDE
//      env vars (never NEXT_PUBLIC_*).
//
// Until then `activeProvider()` returns null, /api/anime/jobs answers 503 with
// code `provider_not_configured`, and the Studio shows an explicit
// "video generation is not connected" state. No placeholder clip is ever
// written, and no job is ever marked completed without real bytes in the bucket.
// ════════════════════════════════════════════════════
import type { VideoProvider } from './types'

/**
 * Registered implementations, keyed by id. Empty by design — see the boundary
 * note above. Adding an entry is the ONLY change needed to light up generation;
 * every other layer already treats jobs as real, asynchronous work.
 */
const PROVIDERS: Record<string, VideoProvider> = {}

/**
 * The provider that should handle new jobs, or null when none is connected.
 * Selection is server-side config only (VIDEO_PROVIDER) — a client can never
 * choose or influence which vendor runs, or make one appear.
 */
export function activeProvider(): VideoProvider | null {
  const requested = process.env.VIDEO_PROVIDER?.trim()
  if (requested) {
    const provider = PROVIDERS[requested]
    if (!provider) {
      console.error(`[anime/provider] VIDEO_PROVIDER="${requested}" is not registered`)
      return null
    }
    if (!provider.isConfigured()) {
      console.error(`[anime/provider] provider "${requested}" is registered but not configured`)
      return null
    }
    return provider
  }
  // No explicit choice: take the first configured provider, if any.
  return Object.values(PROVIDERS).find((p) => p.isConfigured()) ?? null
}

/** Look up the provider that ORIGINALLY accepted a job, for polling/cancelling. */
export function providerById(id: string): VideoProvider | null {
  const provider = PROVIDERS[id]
  return provider?.isConfigured() ? provider : null
}

/** Whether video generation can run at all right now. Drives the UI's empty state. */
export function isVideoGenerationConfigured(): boolean {
  return activeProvider() !== null
}

export type { VideoProvider } from './types'
