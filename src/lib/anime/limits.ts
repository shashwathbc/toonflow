// Entitlement + abuse limits for AI video generation.
//
// Video generation is by far the most expensive thing a user can ask this
// platform to do — orders of magnitude above an image or a chapter of text. So
// unlike the image surface (which is capped only by rate), video is capped on
// FOUR independent axes, each of which closes a different bypass:
//
//   1. Rate     — how fast one account can submit (aiRateLimit bucket).
//   2. Quota    — how many jobs one account may run per rolling day.
//   3. Shape    — duration/resolution ceilings per entitlement tier, so a
//                 crafted request can't ask for a 10-minute 4K clip.
//   4. Spend    — a platform-wide daily ceiling + kill switch (spendGuard).
//
// Every one of these is enforced SERVER-SIDE. The client mirrors the tier
// ceilings purely to grey out controls; it is never the enforcement point.

import type { ResolutionId } from '@/types/anime'

/** Entitlement tiers. Derived server-side from the user document, never sent up. */
export type EntitlementTier = 'free' | 'creator' | 'admin'

export interface TierLimits {
  /** Max clip length a single generation may request, seconds. */
  maxDurationSec: number
  /** Highest resolution this tier may request. */
  maxResolution: ResolutionId
  /** Generation jobs per rolling 24h. */
  dailyJobs: number
  /** Jobs that may be in flight (queued/processing) at once. */
  concurrentJobs: number
  /** Projects an account may own. */
  maxProjects: number
  /** Scenes per project. */
  maxScenesPerProject: number
  /** Saved characters per account. */
  maxCharacters: number
}

const RESOLUTION_RANK: Record<ResolutionId, number> = { '480p': 0, '720p': 1, '1080p': 2 }

export const TIER_LIMITS: Record<EntitlementTier, TierLimits> = {
  free: {
    maxDurationSec: 8,
    maxResolution: '720p',
    dailyJobs: 12,
    concurrentJobs: 2,
    maxProjects: 10,
    maxScenesPerProject: 20,
    maxCharacters: 12,
  },
  creator: {
    maxDurationSec: 16,
    maxResolution: '1080p',
    dailyJobs: 60,
    concurrentJobs: 4,
    maxProjects: 50,
    maxScenesPerProject: 60,
    maxCharacters: 60,
  },
  admin: {
    maxDurationSec: 30,
    maxResolution: '1080p',
    dailyJobs: 500,
    concurrentJobs: 8,
    maxProjects: 500,
    maxScenesPerProject: 200,
    maxCharacters: 500,
  },
}

/** Absolute ceilings, independent of tier — the outer bound of the schema. */
export const HARD_LIMITS = {
  promptMaxChars: 2000,
  negativePromptMaxChars: 600,
  titleMaxChars: 120,
  descriptionMaxChars: 2000,
  /** Longest clip any tier could ever request — keeps the zod schema bounded. */
  maxDurationSec: 30,
  minDurationSec: 2,
  /** Characters attachable to a single generation (prompt-length control). */
  maxCharactersPerScene: 4,
  /** Storyboard beats the AI planner may return in one call. */
  maxStoryboardBeats: 12,
  /** Tracks / clips a saved timeline may contain (bounds the document size). */
  maxTracks: 24,
  maxClipsPerTrack: 200,
  /** Firestore hard-caps a document at 1MiB; stay well under with the timeline. */
  maxTimelineBytes: 700 * 1024,
} as const

export function tierLimits(tier: EntitlementTier): TierLimits {
  return TIER_LIMITS[tier]
}

/** True when `requested` is within the tier's resolution ceiling. */
export function resolutionAllowed(tier: EntitlementTier, requested: ResolutionId): boolean {
  return RESOLUTION_RANK[requested] <= RESOLUTION_RANK[TIER_LIMITS[tier].maxResolution]
}

/** Resolutions this tier may pick — used to disable options in the UI. */
export function allowedResolutions(tier: EntitlementTier): ResolutionId[] {
  return (Object.keys(RESOLUTION_RANK) as ResolutionId[]).filter((r) => resolutionAllowed(tier, r))
}
