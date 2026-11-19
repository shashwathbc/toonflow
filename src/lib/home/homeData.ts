// Server-side loader for the home page feed.
//
// WHY THIS EXISTS (the page was slow for exactly this reason):
// the home page used to ship a skeleton and nothing else. The real sequence a
// visitor experienced was
//
//   HTML (skeletons) → download+parse JS → hydrate → init Firebase web SDK →
//   4 Firestore queries → render cards → *only now* do <img> tags exist →
//   /_next/image fetches + resizes ~30 covers
//
// Covers could not begin downloading until the fourth step completed, so the
// browser's preload scanner — the thing that normally has images in flight
// before React has even booted — had nothing to find. Fetching here instead
// puts real <img src> in the initial HTML, which moves cover downloads to the
// very first moment of the page and off the JS critical path entirely.
//
// Runs through the Admin SDK (no security-rule round trip, no client bundle
// cost) and is wrapped in ISR by the page, so the two Firestore queries below
// serve every visitor for the whole revalidate window instead of running once
// per browser.
//
// FAIL-SOFT: missing Admin credentials or a Firestore blip returns empty
// arrays, and the client components fall back to their original browser-side
// fetch. A slow catalog query must never turn into a 500 on the home page.
import { cache } from 'react'
import type { HomeFeedData, HomeItem } from '@/types/home'
import type { ContentStatus, FirestoreTimestamp } from '@/types'

/** Statuses that are actually readable — `draft` and `hiatus`-only edge cases
 *  are handled by the same list the trending queries have always used. */
const LIVE_STATUSES = ['published', 'ongoing', 'completed']

/** How many docs to pull per collection before ranking in memory.
 *  Deliberately NOT an indexed `orderBy('viewCount')`: that needs a composite
 *  index alongside the visibility filter, and this runs once per revalidate
 *  window, not per request. */
const SCAN_LIMIT = 60

/** Firestore Timestamps are class instances and can't cross the RSC boundary —
 *  flatten to the plain `{ seconds, nanoseconds }` shape the app already uses
 *  everywhere (see FirestoreTimestamp), so compareTimestampsDesc keeps working
 *  unchanged on the client. */
function toPlainTimestamp(value: unknown): FirestoreTimestamp | null {
  const ts = value as { seconds?: unknown; nanoseconds?: unknown } | null | undefined
  if (!ts || typeof ts.seconds !== 'number') return null
  return {
    seconds: ts.seconds,
    nanoseconds: typeof ts.nanoseconds === 'number' ? ts.nanoseconds : 0,
  }
}

function toHomeItem(
  id: string,
  d: Record<string, unknown>,
  type: 'novel' | 'webtoon'
): HomeItem {
  const countKey = type === 'novel' ? 'chapterCount' : 'episodeCount'
  return {
    id,
    type,
    title: typeof d.title === 'string' ? d.title : '',
    synopsis: typeof d.synopsis === 'string' ? d.synopsis : '',
    coverURL: typeof d.coverURL === 'string' ? d.coverURL : null,
    bannerURL: typeof d.bannerURL === 'string' ? d.bannerURL : null,
    status: (typeof d.status === 'string' ? d.status : 'published') as ContentStatus,
    genres: Array.isArray(d.genres) ? (d.genres as string[]) : [],
    viewCount: typeof d.viewCount === 'number' ? d.viewCount : 0,
    rating: typeof d.rating === 'number' ? d.rating : 0,
    partCount: typeof d[countKey] === 'number' ? (d[countKey] as number) : 0,
    publishedAt: toPlainTimestamp(d.publishedAt),
    createdAt: toPlainTimestamp(d.createdAt),
  }
}

/** Seconds-precision recency key; `publishedAt` falls back to `createdAt`
 *  because content published straight from creation never gets a publish step
 *  and would otherwise sort to the bottom (same rule as getNewReleases). */
function recencyOf(item: HomeItem): number {
  const ts = item.publishedAt ?? item.createdAt
  return ts ? ts.seconds : 0
}

const EMPTY: HomeFeedData = { trending: [], newReleases: [], novels: [], webtoons: [] }

/**
 * One pass over the public catalog that feeds all four home sections.
 *
 * Two collection reads replace the four separate client queries the page used
 * to fire (trending novels, trending webtoons, and both halves of new
 * releases), and `cache()` dedupes them across the hero and the feed within a
 * single render.
 */
export const getHomeFeed = cache(async (): Promise<HomeFeedData> => {
  try {
    const { adminDb } = await import('@/lib/firebase/serverApp')
    const db = adminDb()

    // `visibility == public` is a single-field filter, so this relies only on
    // the automatic index and can never fail with FAILED_PRECONDITION.
    const [novelSnap, webtoonSnap] = await Promise.all([
      db.collection('novels').where('visibility', '==', 'public').limit(SCAN_LIMIT).get(),
      db.collection('webtoons').where('visibility', '==', 'public').limit(SCAN_LIMIT).get(),
    ])

    const novels = novelSnap.docs
      .map((doc) => toHomeItem(doc.id, doc.data() as Record<string, unknown>, 'novel'))
      .filter((n) => LIVE_STATUSES.includes(n.status))
    const webtoons = webtoonSnap.docs
      .map((doc) => toHomeItem(doc.id, doc.data() as Record<string, unknown>, 'webtoon'))
      .filter((w) => LIVE_STATUSES.includes(w.status))
    const byViews = (a: HomeItem, b: HomeItem) => b.viewCount - a.viewCount
    const topNovels = [...novels].sort(byViews).slice(0, 12)
    const topWebtoons = [...webtoons].sort(byViews).slice(0, 12)

    return {
      trending: [...topNovels, ...topWebtoons].sort(byViews).slice(0, 12),
      newReleases: [...novels, ...webtoons]
        .sort((a, b) => recencyOf(b) - recencyOf(a))
        .slice(0, 6),
      novels: topNovels,
      webtoons: topWebtoons,
    }
  } catch {
    // No credentials / Firestore unavailable — the client components still have
    // their own fetch path, so the page degrades to its previous behaviour
    // rather than failing.
    return EMPTY
  }
})
