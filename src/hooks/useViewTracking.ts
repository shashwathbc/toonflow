'use client'

// Client half of the two-phase view protocol (see /api/views).
//
// A view is earned the moment a chapter/episode is OPENED — there is no reading
// time to wait out. The hook asks the server for a signed token and immediately
// completes it. Everything that decides whether the view is REAL (bot signals,
// token authenticity, visitor identity, duplicate suppression, rate limits)
// lives on the server; this hook only reports "this reader just opened this".
import { useEffect } from 'react'
import { invalidateRequest } from '@/lib/utils/requestCache'

export interface ViewTrackingTarget {
  contentType: 'chapter' | 'episode'
  contentId: string
  parentId: string
}

// One open must produce exactly one view — but the effect is torn down and
// re-run more than once per open: React Strict Mode double-mounts every effect
// in development, and a fast soft navigation can remount the reader within
// milliseconds. A module-scope stamp per target swallows those repeats.
//
// The window is deliberately short. It is NOT a per-day cap: re-opening the
// chapter later counts again, which is the product rule ("every open is a
// view"). Abuse is bounded server-side by the per-IP / per-visitor / per-session
// rate limits in VIEW_CONFIG, not here.
const SAME_OPEN_WINDOW_MS = 5_000
const firedAt = new Map<string, number>()

function getSessionId(): string {
  try {
    const key = 'tf_session_id'
    let id = sessionStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '')
      sessionStorage.setItem(key, id)
    }
    return id
  } catch {
    return crypto.randomUUID().replace(/-/g, '')
  }
}

/** Current scroll depth, reported for analytics only (it no longer gates the view). */
function scrollPercentage(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  if (max <= 0) return 100 // content fits in one screen → fully visible
  return Math.max(0, Math.min(100, Math.round(((window.scrollY + window.innerHeight * 0.5) / max) * 100)))
}

/** Home-page carousels serve from a 60s promise cache, so a freshly counted view
 *  would otherwise stay invisible there until the TTL lapsed. */
function refreshCachedFeeds(): void {
  invalidateRequest('trending-')
  invalidateRequest('new-releases')
}

/** Pass null until the content has loaded; the hook fires once per open. */
export function useViewTracking(target: ViewTrackingTarget | null): void {
  const contentType = target?.contentType
  const contentId = target?.contentId
  const parentId = target?.parentId

  useEffect(() => {
    if (!contentType || !contentId || !parentId) return
    if (typeof window === 'undefined') return
    if (navigator.webdriver) return

    const key = `${contentType}:${contentId}`
    const now = Date.now()
    const last = firedAt.get(key)
    if (last !== undefined && now - last < SAME_OPEN_WINDOW_MS) return
    firedAt.set(key, now)

    // Deliberately NOT cancelled on unmount. The view is earned as soon as the
    // page opens, and Strict Mode tears this effect down within milliseconds —
    // aborting here is exactly what used to make views never count. `keepalive`
    // lets the request outlive the page if the reader navigates away instantly.
    const post = (body: unknown) =>
      fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      })

    // Failed attempts release the stamp so the next render/open can retry;
    // tracking is best-effort and must never break reading.
    const release = () => { firedAt.delete(key) }

    void (async () => {
      try {
        const beginRes = await post({
          phase: 'begin',
          contentType,
          contentId,
          parentId,
          webdriver: !!navigator.webdriver,
        })
        if (!beginRes.ok) return release()

        const { token } = (await beginRes.json()) as { token?: string }
        if (!token) return release()

        const completeRes = await post({
          phase: 'complete',
          token,
          contentType,
          contentId,
          parentId,
          sessionId: getSessionId(),
          engagementDurationMs: Math.max(0, Date.now() - now),
          scrollPercentage: scrollPercentage(),
          webdriver: !!navigator.webdriver,
        })
        if (!completeRes.ok) return release()

        const result = (await completeRes.json()) as { counted?: boolean }
        if (result.counted) refreshCachedFeeds()
      } catch {
        release()
      }
    })()
  }, [contentType, contentId, parentId])
}
