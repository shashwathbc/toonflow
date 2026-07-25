'use client'

// Client half of the two-phase view protocol (see /api/views).
// Measures only VISIBLE time (Page Visibility API) and max scroll depth, and
// fires the complete request once the local threshold is met. The server
// re-validates everything — this hook merely decides when to ask.
import { useEffect, useRef } from 'react'

export interface ViewTrackingTarget {
  contentType: 'chapter' | 'episode'
  contentId: string
  parentId: string
}

// Client-side mirrors of the server thresholds (server is authoritative). These
// sit ~1s ABOVE the server floors (server: 5s / 3s) on purpose: the server times
// dwell from token issue (begin), so begin/complete network latency makes its
// measured dwell slightly SHORTER than the client's visible-time clock. The
// margin guarantees that when the client decides to fire, the server's dwell has
// comfortably cleared its floor — otherwise a near-threshold view would be
// rejected yet still guarded for 24h, and silently lost.
const MIN_VISIBLE_MS = 6_000
const MIN_SCROLL_PCT = 50
const MIN_VISIBLE_WITH_SCROLL_MS = 4_000
const GUARD_WINDOW_MS = 24 * 60 * 60 * 1000

function guardKey(t: ViewTrackingTarget) {
  return `tf_viewed_${t.contentType}_${t.contentId}`
}

function isGuarded(t: ViewTrackingTarget): boolean {
  try {
    const raw = localStorage.getItem(guardKey(t))
    if (!raw) return false
    if (Date.now() - Number(raw) < GUARD_WINDOW_MS) return true
    localStorage.removeItem(guardKey(t))
    return false
  } catch {
    return false
  }
}

function setGuard(t: ViewTrackingTarget) {
  try { localStorage.setItem(guardKey(t), String(Date.now())) } catch { /* private mode */ }
}

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

/** Pass null until the content has loaded; the hook activates once per target. */
export function useViewTracking(target: ViewTrackingTarget | null): void {
  const startedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!target) return
    const targetKey = `${target.contentType}:${target.contentId}`
    if (startedFor.current === targetKey) return
    startedFor.current = targetKey

    if (typeof window === 'undefined') return
    if (navigator.webdriver) return
    if (isGuarded(target)) return

    let token: string | null = null
    let sent = false
    let disposed = false

    // ── Visible-time accumulator ────────────────────────────
    let visibleMs = 0
    let visibleSince: number | null = document.visibilityState === 'visible' ? Date.now() : null

    const flushVisible = () => {
      if (visibleSince !== null) {
        visibleMs += Date.now() - visibleSince
        visibleSince = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (visibleSince === null) visibleSince = Date.now()
      } else {
        flushVisible()
      }
    }

    // ── Scroll depth ────────────────────────────────────────
    let maxScrollPct = 0
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max > 0
        ? Math.min(100, Math.round(((window.scrollY + window.innerHeight * 0.5) / max) * 100))
        : 100 // content fits in one screen → fully visible
      if (pct > maxScrollPct) maxScrollPct = pct
    }

    const currentVisibleMs = () =>
      visibleMs + (visibleSince !== null ? Date.now() - visibleSince : 0)

    const thresholdMet = () => {
      const v = currentVisibleMs()
      return v >= MIN_VISIBLE_MS || (maxScrollPct >= MIN_SCROLL_PCT && v >= MIN_VISIBLE_WITH_SCROLL_MS)
    }

    const buildPayload = () => JSON.stringify({
      phase: 'complete',
      token,
      contentType: target.contentType,
      contentId: target.contentId,
      parentId: target.parentId,
      sessionId: getSessionId(),
      engagementDurationMs: Math.round(currentVisibleMs()),
      scrollPercentage: maxScrollPct,
      webdriver: !!navigator.webdriver,
    })

    const complete = async () => {
      if (sent || !token || !thresholdMet()) return
      sent = true
      try {
        const res = await fetch('/api/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: buildPayload(),
          keepalive: true,
        })
        if (res.ok) setGuard(target) // counted OR deduped — either way, don't retry today
      } catch {
        sent = false // network hiccup: allow the interval to retry
      }
    }

    // Last-chance send when the reader leaves mid-read but already qualifies
    const onPageHide = () => {
      flushVisible()
      if (sent || !token || !thresholdMet()) return
      sent = true
      const blob = new Blob([buildPayload()], { type: 'application/json' })
      if (navigator.sendBeacon?.('/api/views', blob)) setGuard(target)
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', onPageHide)

    // Poll every 1s so a qualifying view fires promptly once the (few-second)
    // threshold is crossed, instead of lagging up to a full interval behind.
    const interval = setInterval(() => { void complete() }, 1_000)

    // ── Begin phase: get the server-timestamped view token ──
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'begin',
        contentType: target.contentType,
        contentId: target.contentId,
        parentId: target.parentId,
        webdriver: !!navigator.webdriver,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { token?: string } | null) => {
        if (!disposed && data?.token) token = data.token
      })
      .catch(() => { /* tracking is best-effort; never break reading */ })

    return () => {
      disposed = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', onPageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.contentType, target?.contentId, target?.parentId])
}
