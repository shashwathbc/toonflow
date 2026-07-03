// Business analytics for the super admin dashboard. Reads the private
// chapterViews log and users collection via the Admin SDK — clients can never
// query these directly. Super admin only.
import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { AUTH_COOKIE_NAME, SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const WINDOW_DAYS = 14
const LIVE_WINDOW_MS = 5 * 60 * 1000

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface AdminAnalytics {
  liveUsers: number
  readers14d: number
  views14d: number
  avgEngagementSec: number
  avgScrollPct: number
  authViews: number
  anonViews: number
  traffic: { date: string; views: number; readers: number }[]
  signups: { date: string; users: number }[]
  topContent: { title: string; type: 'novel' | 'webtoon'; views: number }[]
}

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    if (decoded.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Pre-fill every day in the window so charts show gaps as zero, not missing.
  const days: string[] = []
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    days.push(dayKey(new Date(now - i * 24 * 60 * 60 * 1000)))
  }

  const [viewSnaps, signupSnaps, novelSnaps, webtoonSnaps] = await Promise.all([
    db.collection('chapterViews')
      .where('viewedAt', '>=', Timestamp.fromDate(windowStart))
      .select('viewedAt', 'userId', 'anonymousVisitorId', 'sessionId', 'engagementDuration', 'scrollPercentage')
      .limit(20000)
      .get(),
    db.collection('users')
      .where('createdAt', '>=', Timestamp.fromDate(windowStart))
      .select('createdAt')
      .limit(20000)
      .get(),
    db.collection('novels').orderBy('viewCount', 'desc').select('title', 'viewCount').limit(5).get(),
    db.collection('webtoons').orderBy('viewCount', 'desc').select('title', 'viewCount').limit(5).get(),
  ])

  const viewsPerDay: Record<string, number> = {}
  const readersPerDay: Record<string, Set<string>> = {}
  const readersAll = new Set<string>()
  const liveViewers = new Set<string>()
  let authViews = 0
  let anonViews = 0
  let engagementSum = 0
  let scrollSum = 0

  viewSnaps.docs.forEach((d) => {
    const v = d.data()
    const viewedAt: Timestamp | undefined = v.viewedAt
    if (!viewedAt) return
    const ms = viewedAt.toMillis()
    const day = dayKey(viewedAt.toDate())
    const viewer: string = v.userId ? `u:${v.userId}` : `a:${v.anonymousVisitorId ?? v.sessionId ?? d.id}`

    viewsPerDay[day] = (viewsPerDay[day] ?? 0) + 1
    ;(readersPerDay[day] ??= new Set()).add(viewer)
    readersAll.add(viewer)
    if (now - ms <= LIVE_WINDOW_MS) liveViewers.add(viewer)
    if (v.userId) authViews += 1
    else anonViews += 1
    engagementSum += v.engagementDuration ?? 0
    scrollSum += v.scrollPercentage ?? 0
  })

  const signupsPerDay: Record<string, number> = {}
  signupSnaps.docs.forEach((d) => {
    const createdAt: Timestamp | undefined = d.data().createdAt
    if (!createdAt) return
    const day = dayKey(createdAt.toDate())
    signupsPerDay[day] = (signupsPerDay[day] ?? 0) + 1
  })

  const totalViews = viewSnaps.size
  const topContent = [
    ...novelSnaps.docs.map((d) => ({ title: (d.data().title as string) || 'Untitled', type: 'novel' as const, views: (d.data().viewCount as number) ?? 0 })),
    ...webtoonSnaps.docs.map((d) => ({ title: (d.data().title as string) || 'Untitled', type: 'webtoon' as const, views: (d.data().viewCount as number) ?? 0 })),
  ]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)

  const payload: AdminAnalytics = {
    liveUsers: liveViewers.size,
    readers14d: readersAll.size,
    views14d: totalViews,
    avgEngagementSec: totalViews > 0 ? Math.round(engagementSum / totalViews / 1000) : 0,
    avgScrollPct: totalViews > 0 ? Math.round(scrollSum / totalViews) : 0,
    authViews,
    anonViews,
    traffic: days.map((date) => ({
      date,
      views: viewsPerDay[date] ?? 0,
      readers: readersPerDay[date]?.size ?? 0,
    })),
    signups: days.map((date) => ({ date, users: signupsPerDay[date] ?? 0 })),
    topContent,
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
