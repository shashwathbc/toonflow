// Creator/admin analytics for a chapter or episode. Reads the private
// viewStats aggregates — never exposed to the public and never mixed with
// the public viewCount.
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/serverApp'
import { isViewContentType } from '@/lib/views/config'
import { AUTH_COOKIE_NAME } from '@/lib/utils/constants'

export const runtime = 'nodejs'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    uid = (await adminAuth().verifyIdToken(idToken)).uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const contentType = searchParams.get('contentType')
  const contentId = searchParams.get('contentId')
  const parentId = searchParams.get('parentId')
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30)))

  if (!isViewContentType(contentType) || !contentId || !ID_RE.test(contentId) || !parentId || !ID_RE.test(parentId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const db = adminDb()

  // Only the content owner or an admin may read analytics
  const parentColl = contentType === 'chapter' ? 'novels' : 'webtoons'
  const [parentSnap, userSnap] = await Promise.all([
    db.doc(`${parentColl}/${parentId}`).get(),
    db.doc(`users/${uid}`).get(),
  ])
  if (!parentSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isOwner = parentSnap.data()?.authorId === uid
  const isAdmin = ['admin', 'superadmin'].includes(userSnap.data()?.role)
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const statsKey = `${contentType}_${contentId}`
  const statsRef = db.doc(`viewStats/${statsKey}`)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [totalsSnap, dailySnaps] = await Promise.all([
    statsRef.get(),
    statsRef.collection('daily')
      .where('date', '>=', dayKey(since))
      .orderBy('date', 'asc')
      .get(),
  ])

  const t = totalsSnap.exists ? totalsSnap.data()! : {}
  const totalViews = t.totalViews ?? 0

  const daily = dailySnaps.docs.map((d) => {
    const v = d.data()
    return {
      date: v.date as string,
      views: v.totalViews ?? 0,
      uniqueVisitors: v.uniqueVisitors ?? 0,
      returningViews: v.returningViews ?? 0,
      avgEngagementMs: v.totalViews ? Math.round((v.totalEngagementMs ?? 0) / v.totalViews) : 0,
      avgScrollPct: v.totalViews ? Math.round((v.totalScrollPct ?? 0) / v.totalViews) : 0,
    }
  })

  const sumLast = (n: number, field: 'views' | 'uniqueVisitors') =>
    daily.slice(-n).reduce((acc, d) => acc + d[field], 0)

  return NextResponse.json({
    totals: {
      totalViews,
      uniqueVisitors: t.uniqueVisitors ?? 0,
      returningViews: t.returningViews ?? 0,
      totalReadingTimeMs: t.totalEngagementMs ?? 0,
      avgEngagementMs: totalViews ? Math.round((t.totalEngagementMs ?? 0) / totalViews) : 0,
      avgCompletionPct: totalViews ? Math.round((t.totalScrollPct ?? 0) / totalViews) : 0,
    },
    windows: {
      dailyViews: sumLast(1, 'views'),
      weeklyViews: sumLast(7, 'views'),
      monthlyViews: sumLast(30, 'views'),
      dailyUniqueVisitors: sumLast(1, 'uniqueVisitors'),
      weeklyUniqueVisitors: sumLast(7, 'uniqueVisitors'),
      monthlyUniqueVisitors: sumLast(30, 'uniqueVisitors'),
    },
    daily,
  })
}
