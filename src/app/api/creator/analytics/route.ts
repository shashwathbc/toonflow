// Creator analytics — aggregates the private chapterViews log for ONE
// creator's own content via the Admin SDK. The verified auth cookie decides
// whose analytics are returned; a client can never request another creator's
// numbers or touch the underlying log (Firestore rules deny all client access).
import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'
import { CREATOR_EARNINGS_PER_VIEW, CREATOR_RPM, GROSS_CPM, viewsToCreatorInr } from '@/lib/revenue/config'
import type { AnalyticsDay, CreatorAnalytics, TopChapter, TopStory } from '@/types/analytics'

export const runtime = 'nodejs'

const WINDOW_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000
/** Firestore `in` filters accept at most 30 values per query. */
const IN_CHUNK = 30
const VIEW_LOG_LIMIT = 20000

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    uid = (await adminAuth().verifySessionCookie(idToken, true)).uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_DAYS * DAY_MS)

  // Pre-fill every day so charts show zero, not gaps.
  const days: string[] = []
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) days.push(dayKey(new Date(now - i * DAY_MS)))

  const [novelSnaps, webtoonSnaps, userSnap, followerSnaps] = await Promise.all([
    db.collection('novels').where('authorId', '==', uid).select('title', 'viewCount').get(),
    db.collection('webtoons').where('authorId', '==', uid).select('title', 'viewCount').get(),
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/followers`)
      .where('createdAt', '>=', Timestamp.fromDate(windowStart))
      .select('createdAt')
      .limit(VIEW_LOG_LIMIT)
      .get(),
  ])

  const contentTitles = new Map<string, { title: string; type: 'novel' | 'webtoon'; views: number }>()
  novelSnaps.docs.forEach((d) => contentTitles.set(d.id, {
    title: (d.data().title as string) || 'Untitled',
    type: 'novel',
    views: (d.data().viewCount as number) ?? 0,
  }))
  webtoonSnaps.docs.forEach((d) => contentTitles.set(d.id, {
    title: (d.data().title as string) || 'Untitled',
    type: 'webtoon',
    views: (d.data().viewCount as number) ?? 0,
  }))
  const contentIds = [...contentTitles.keys()]

  // View log for this creator's content — chunked `in` queries (30 ids max each)
  const viewDocs = (await Promise.all(
    chunk(contentIds, IN_CHUNK).map((ids) =>
      db.collection('chapterViews')
        .where('parentId', 'in', ids)
        .where('viewedAt', '>=', Timestamp.fromDate(windowStart))
        .select('viewedAt', 'userId', 'anonymousVisitorId', 'sessionId', 'engagementDuration', 'scrollPercentage', 'chapterId', 'parentId', 'contentType')
        .limit(VIEW_LOG_LIMIT)
        .get(),
    ),
  )).flatMap((snap) => snap.docs)

  const todayKey = dayKey(new Date(now))
  const weekStart = now - 7 * DAY_MS
  const monthStart = now - 30 * DAY_MS

  const viewsPerDay: Record<string, number> = {}
  const readersPerDay: Record<string, Set<string>> = {}
  const viewerDays30 = new Map<string, Set<string>>()
  const chapterViews = new Map<string, { views: number; parentId: string; type: 'chapter' | 'episode' }>()
  let todayViews = 0
  let weekViews = 0
  let monthViews = 0
  let engagementSum30 = 0
  let scrollSum30 = 0
  let monthCount = 0

  viewDocs.forEach((d) => {
    const v = d.data()
    const viewedAt: Timestamp | undefined = v.viewedAt
    if (!viewedAt) return
    const ms = viewedAt.toMillis()
    const day = dayKey(viewedAt.toDate())
    const viewer: string = v.userId ? `u:${v.userId}` : `a:${v.anonymousVisitorId ?? v.sessionId ?? d.id}`

    viewsPerDay[day] = (viewsPerDay[day] ?? 0) + 1
    ;(readersPerDay[day] ??= new Set()).add(viewer)

    if (day === todayKey) todayViews += 1
    if (ms >= weekStart) weekViews += 1
    if (ms >= monthStart) {
      monthViews += 1
      monthCount += 1
      engagementSum30 += v.engagementDuration ?? 0
      scrollSum30 += v.scrollPercentage ?? 0
      let set = viewerDays30.get(viewer)
      if (!set) { set = new Set(); viewerDays30.set(viewer, set) }
      set.add(day)
    }

    const chapterId: string = v.chapterId ?? d.id
    const entry = chapterViews.get(chapterId)
    if (entry) entry.views += 1
    else chapterViews.set(chapterId, {
      views: 1,
      parentId: v.parentId ?? '',
      type: v.contentType === 'episode' ? 'episode' : 'chapter',
    })
  })

  // Follower growth — new followers per day, cumulative anchored to the
  // CURRENT count (works even though older follows predate the subcollection).
  const followerCount = (userSnap.data()?.followerCount as number) ?? 0
  const newFollowersPerDay: Record<string, number> = {}
  followerSnaps.docs.forEach((d) => {
    const createdAt: Timestamp | undefined = d.data().createdAt
    if (!createdAt) return
    const day = dayKey(createdAt.toDate())
    newFollowersPerDay[day] = (newFollowersPerDay[day] ?? 0) + 1
  })
  const cumulative: number[] = new Array(days.length)
  let running = followerCount
  for (let i = days.length - 1; i >= 0; i--) {
    cumulative[i] = Math.max(0, running)
    running -= newFollowersPerDay[days[i]] ?? 0
  }

  const daily: AnalyticsDay[] = days.map((date, i) => {
    const views = viewsPerDay[date] ?? 0
    return {
      date,
      views,
      readers: readersPerDay[date]?.size ?? 0,
      revenueInr: Math.round(views * CREATOR_EARNINGS_PER_VIEW * 100) / 100,
      newFollowers: newFollowersPerDay[date] ?? 0,
      cumulativeFollowers: cumulative[i],
    }
  })

  const lifetimeViews = [...contentTitles.values()].reduce((s, c) => s + c.views, 0)

  const topStories: TopStory[] = [...contentTitles.entries()]
    .map(([id, c]) => ({ id, title: c.title, type: c.type, views: c.views, revenueInr: viewsToCreatorInr(c.views) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)

  // Top chapters in the window — resolve titles from the subcollection docs.
  const topChapterEntries = [...chapterViews.entries()]
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 5)
  const topChapters: TopChapter[] = (await Promise.all(
    topChapterEntries.map(async ([id, entry]) => {
      const parent = contentTitles.get(entry.parentId)
      if (!parent) return null
      const path = entry.type === 'chapter'
        ? `novels/${entry.parentId}/chapters/${id}`
        : `webtoons/${entry.parentId}/episodes/${id}`
      let title = 'Untitled'
      try {
        const snap = await db.doc(path).get()
        const data = snap.data()
        if (data?.title) title = data.title as string
        else if (data?.chapterNumber != null) title = `Chapter ${data.chapterNumber}`
        else if (data?.episodeNumber != null) title = `Episode ${data.episodeNumber}`
      } catch { /* keep fallback title */ }
      return { id, title, parentId: entry.parentId, parentTitle: parent.title, type: entry.type, views: entry.views }
    }),
  )).filter((c): c is TopChapter => c !== null)

  const returningReaders30d = [...viewerDays30.values()].filter((set) => set.size > 1).length

  const payload: CreatorAnalytics = {
    lifetimeViews,
    todayViews,
    weekViews,
    monthViews,
    followerCount,
    uniqueReaders30d: viewerDays30.size,
    returningReaders30d,
    avgReadTimeSec: monthCount > 0 ? Math.round(engagementSum30 / monthCount / 1000) : 0,
    completionRatePct: monthCount > 0 ? Math.round(scrollSum30 / monthCount) : 0,
    rpmInr: CREATOR_RPM,
    cpmInr: GROSS_CPM,
    estimatedRevenue30dInr: viewsToCreatorInr(monthViews),
    lifetimeRevenueInr: viewsToCreatorInr(lifetimeViews),
    daily,
    topStories,
    topChapters,
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
