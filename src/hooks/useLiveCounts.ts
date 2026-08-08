'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'

export interface LiveCounts {
  viewCount: number
  likeCount: number
}

/**
 * Returns a novel/webtoon's public engagement counters, updating in real time.
 *
 * Views are written server-side (Admin SDK via /api/views) and likes client-side
 * (`toggleLike`); both land on the same parent document, so ONE listener keeps
 * every on-screen figure honest — including likes from other readers. Used only
 * on focused pages (a work's detail page), never in high-cardinality grids where
 * a listener per card would not scale.
 *
 * Until the first snapshot lands we render `initial` (the values the parent page
 * already fetched), so there's no flash; once a snapshot arrives it becomes the
 * source of truth. The snapshot is keyed by id, so a client-side navigation to a
 * different work falls back to the new `initial` instead of briefly showing the
 * previous work's counts.
 */
export function useLiveCounts(
  collectionName: 'novels' | 'webtoons',
  id: string | null | undefined,
  initial: LiveCounts,
): LiveCounts {
  const [live, setLive] = useState<{ id: string; counts: LiveCounts } | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(
      doc(db, collectionName, id),
      (snap) => {
        const data = snap.data()
        if (!data) return
        setLive({
          id,
          counts: {
            viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
            likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
          },
        })
      },
      () => { /* transient listener errors are non-fatal — keep the last counts */ },
    )
    return unsub
  }, [collectionName, id])

  return live && live.id === id ? live.counts : initial
}
