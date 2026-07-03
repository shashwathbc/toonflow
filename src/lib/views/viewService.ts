// Server-side view recording. All writes go through the Admin SDK in a single
// Firestore transaction, so concurrent duplicate requests cannot double-count.
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/serverApp'
import { saltedHash } from './crypto'
import { VIEW_CONFIG, type ViewContentType } from './config'

export interface RecordViewInput {
  contentType: ViewContentType
  contentId: string
  /** novelId for chapters, webtoonId for episodes */
  parentId: string
  /** verified Firebase uid, if signed in */
  userId: string | null
  /** verified anonymous visitor id (from the signed cookie) */
  anonymousVisitorId: string
  sessionId: string
  ip: string
  userAgent: string
  /** client-reported visible engagement, clamped server-side */
  engagementDurationMs: number
  /** client-reported max scroll depth, clamped server-side */
  scrollPercentage: number
}

export interface RecordViewResult {
  counted: boolean
  reason: 'counted' | 'duplicate-in-window' | 'content-not-found'
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function contentPath(contentType: ViewContentType, parentId: string, contentId: string) {
  return contentType === 'chapter'
    ? { parent: `novels/${parentId}`, content: `novels/${parentId}/chapters/${contentId}` }
    : { parent: `webtoons/${parentId}`, content: `webtoons/${parentId}/episodes/${contentId}` }
}

/**
 * Atomically records a validated view:
 *  - viewDedup/{key}         one doc per visitor+content, rolling 24h window
 *  - chapterViews/{auto}     immutable per-view analytics log
 *  - viewStats/{key}(+daily) aggregate counters, kept separate from public count
 *  - content + parent docs   public viewCount, atomic increment
 */
export async function recordView(input: RecordViewInput): Promise<RecordViewResult> {
  const db = adminDb()
  const now = Date.now()

  // Identity for dedup: verified uid wins; anonymous visitors fall back to the
  // signed cookie id. Hashed so raw ids never appear in document ids.
  const viewerKey = input.userId ? `u:${input.userId}` : `a:${input.anonymousVisitorId}`
  const viewerHash = saltedHash(viewerKey)

  const statsKey = `${input.contentType}_${input.contentId}`
  const dedupRef = db.doc(`viewDedup/${statsKey}_${viewerHash}`)
  const statsRef = db.doc(`viewStats/${statsKey}`)
  const dailyRef = statsRef.collection('daily').doc(dayKey())
  const logRef = db.collection('chapterViews').doc()
  const paths = contentPath(input.contentType, input.parentId, input.contentId)
  const contentRef = db.doc(paths.content)
  const parentRef = db.doc(paths.parent)

  const engagementMs = Math.max(0, Math.min(input.engagementDurationMs, 6 * 60 * 60 * 1000))
  const scrollPct = Math.max(0, Math.min(100, Math.round(input.scrollPercentage)))

  return db.runTransaction(async (tx) => {
    const [dedupSnap, contentSnap] = await Promise.all([tx.get(dedupRef), tx.get(contentRef)])
    if (!contentSnap.exists) return { counted: false, reason: 'content-not-found' as const }

    const prior = dedupSnap.exists ? dedupSnap.data()! : null
    const lastViewedAt: Timestamp | undefined = prior?.lastViewedAt
    if (lastViewedAt && now - lastViewedAt.toMillis() < VIEW_CONFIG.dedupWindowMs) {
      return { counted: false, reason: 'duplicate-in-window' as const }
    }

    const isFirstEver = !prior
    const isReturning = !!prior // seen before, outside the window

    tx.set(dedupRef, {
      contentType: input.contentType,
      contentId: input.contentId,
      viewerHash,
      isAuthenticated: !!input.userId,
      lastViewedAt: FieldValue.serverTimestamp(),
      firstViewedAt: prior?.firstViewedAt ?? FieldValue.serverTimestamp(),
      countedViews: FieldValue.increment(1),
    }, { merge: true })

    tx.set(logRef, {
      chapterId: input.contentId,
      contentType: input.contentType,
      parentId: input.parentId,
      userId: input.userId,
      anonymousVisitorId: input.userId ? null : saltedHash(input.anonymousVisitorId),
      sessionId: saltedHash(input.sessionId),
      hashedIp: saltedHash(input.ip),
      userAgentHash: saltedHash(input.userAgent),
      viewedAt: FieldValue.serverTimestamp(),
      engagementDuration: engagementMs,
      scrollPercentage: scrollPct,
    })

    const counters = {
      totalViews: FieldValue.increment(1),
      uniqueVisitors: FieldValue.increment(isFirstEver ? 1 : 0),
      returningViews: FieldValue.increment(isReturning ? 1 : 0),
      totalEngagementMs: FieldValue.increment(engagementMs),
      totalScrollPct: FieldValue.increment(scrollPct),
      updatedAt: FieldValue.serverTimestamp(),
    }
    tx.set(statsRef, { contentType: input.contentType, contentId: input.contentId, parentId: input.parentId, ...counters }, { merge: true })
    tx.set(dailyRef, { date: dayKey(), ...counters }, { merge: true })

    // Public counters — atomic increments, never read-modify-write
    tx.update(contentRef, { viewCount: FieldValue.increment(1) })
    tx.update(parentRef, { viewCount: FieldValue.increment(1) })

    return { counted: true, reason: 'counted' as const }
  })
}

/** Fire-and-forget log of rejected/suspicious attempts for later review. */
export function logSuspiciousActivity(entry: {
  reason: string
  contentId?: string
  contentType?: string
  hashedIp: string
  userAgentHash: string
  userId?: string | null
}): void {
  adminDb().collection('suspiciousViews').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => { /* logging must never break the request */ })
}
