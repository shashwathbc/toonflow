'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'

/**
 * Returns a novel/webtoon viewCount that updates in real time.
 *
 * Views are written server-side (Admin SDK via /api/views); this hook subscribes
 * to the parent document so the on-screen number reflects each increment without
 * a page refresh. One listener per mount — used only on focused pages (a work's
 * detail page), never in high-cardinality grids, where a listener per card would
 * not scale.
 *
 * Until the first snapshot lands we render `initial` (the value the parent page
 * already fetched), so there's no flash; once a snapshot arrives it becomes the
 * source of truth. The snapshot is keyed by id, so a client-side navigation to a
 * different work falls back to the new `initial` instead of briefly showing the
 * previous work's count.
 */
export function useLiveViewCount(
  collectionName: 'novels' | 'webtoons',
  id: string | null | undefined,
  initial: number,
): number {
  const [live, setLive] = useState<{ id: string; count: number } | null>(null)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(
      doc(db, collectionName, id),
      (snap) => {
        const v = snap.data()?.viewCount
        if (typeof v === 'number') setLive({ id, count: v })
      },
      () => { /* transient listener errors are non-fatal — keep the last count */ },
    )
    return unsub
  }, [collectionName, id])

  return live && live.id === id ? live.count : initial
}
