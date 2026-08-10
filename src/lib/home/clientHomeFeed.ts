// Browser-side fallback for the home feed.
//
// The home page is server-rendered (see homeData.ts) and normally arrives with
// its feed already populated, so this never runs. It exists for the one case
// the server path can't cover: Admin credentials missing or Firestore
// unavailable during the server render, which returns empty arrays. Rather than
// show an empty home page, the hero and the feed retry from the browser exactly
// the way they always did.
//
// Shared by both components so the fallback fires ONE set of queries for the
// page (cachedRequest dedupes the concurrent calls) instead of one per
// component, and maps into the same HomeItem shape the server sends — so the
// rendering code below has a single input type either way.
import { getTrendingNovels, getTrendingWebtoons, getNewReleases } from '@/lib/firebase/firestore'
import { cachedRequest } from '@/lib/utils/requestCache'
import { compareTimestampsDesc } from '@/lib/utils/timestamps'
import type { Novel, Webtoon } from '@/types'
import type { HomeFeedData, HomeItem } from '@/types/home'

function novelToItem(n: Novel): HomeItem {
  return {
    id: n.id,
    type: 'novel',
    title: n.title,
    synopsis: n.synopsis,
    coverURL: n.coverURL,
    bannerURL: n.bannerURL,
    status: n.status,
    genres: n.genres ?? [],
    viewCount: n.viewCount ?? 0,
    rating: n.rating ?? 0,
    partCount: n.chapterCount ?? 0,
    publishedAt: n.publishedAt ?? null,
    createdAt: n.createdAt ?? null,
  }
}

function webtoonToItem(w: Webtoon): HomeItem {
  return {
    id: w.id,
    type: 'webtoon',
    title: w.title,
    synopsis: w.synopsis,
    coverURL: w.coverURL,
    bannerURL: w.bannerURL ?? null,
    status: w.status,
    genres: w.genres ?? [],
    viewCount: w.viewCount ?? 0,
    rating: w.rating ?? 0,
    partCount: w.episodeCount ?? 0,
    publishedAt: w.publishedAt ?? null,
    createdAt: w.createdAt ?? null,
  }
}

export async function fetchHomeFeed(): Promise<HomeFeedData> {
  const [novelDocs, webtoonDocs, releases] = await Promise.all([
    cachedRequest('trending-novels-12', 60_000, () => getTrendingNovels(12)),
    cachedRequest('trending-webtoons-12', 60_000, () => getTrendingWebtoons(12)),
    cachedRequest('new-releases-6', 60_000, () => getNewReleases(6)),
  ])

  const novels = novelDocs.map(novelToItem)
  const webtoons = webtoonDocs.map(webtoonToItem)
  const byViews = (a: HomeItem, b: HomeItem) => b.viewCount - a.viewCount

  return {
    trending: [...novels, ...webtoons].sort(byViews).slice(0, 12),
    // Sort the MERGED list newest-first so the single latest release leads,
    // instead of listing every novel before every webtoon.
    newReleases: [
      ...releases.novels.map(novelToItem),
      ...releases.webtoons.map(webtoonToItem),
    ]
      .sort((a, b) =>
        compareTimestampsDesc(a.publishedAt ?? a.createdAt, b.publishedAt ?? b.createdAt)
      )
      .slice(0, 6),
    novels,
    webtoons,
  }
}
