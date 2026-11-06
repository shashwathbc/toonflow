'use client'

import { useEffect, useRef } from 'react'

/**
 * Fire-and-forget view ping for a public listing — marketplace artwork and
 * products, and published anime titles.
 *
 * The COUNT is decided entirely server-side (/api/art/view): bot detection,
 * same-origin check, per-day dedup and the increment itself all live there, so
 * this component can't inflate anything — the worst it can do is send a request
 * that gets ignored.
 */
export default function ListingViewTracker({
  kind,
  id,
}: {
  kind: 'artwork' | 'product' | 'anime'
  id: string
}) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    // Delayed slightly so a bounce (open, immediately back out) isn't counted
    // as a view of the listing.
    const timer = setTimeout(() => {
      void fetch('/api/art/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id }),
        keepalive: true,
      }).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(timer)
  }, [kind, id])

  return null
}
