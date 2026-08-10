'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'

export interface LiveCounts {
  viewCount: number
  likeCount: number
}

export type ContentCollection = 'novels' | 'webtoons'

/** novels hold chapters, webtoons hold episodes — the only two shapes there are. */
export function partCollection(collectionName: ContentCollection): 'chapters' | 'episodes' {
  return collectionName === 'novels' ? 'chapters' : 'episodes'
}

/**
 * Shared engine for both hooks below: listens to ONE document and returns its
 * public counters, falling back to `initial` until the first snapshot lands (so
 * there's no flash of zeroes) and whenever the path changes (so a client-side
 * navigation never shows the previous document's numbers).
 */
function useLiveDocCounts(path: string | null, initial: LiveCounts): LiveCounts {
  const [live, setLive] = useState<{ path: string; counts: LiveCounts } | null>(null)

  useEffect(() => {
    if (!path) return
    const [first, ...rest] = path.split('/')
    const unsub = onSnapshot(
      doc(db, first, ...rest),
      (snap) => {
        const data = snap.data()
        if (!data) return
        setLive({
          path,
          counts: {
            viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
            likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
          },
        })
      },
      () => { /* transient listener errors are non-fatal — keep the last counts */ },
    )
    return unsub
  }, [path])

  return live && live.path === path ? live.counts : initial
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
 * The parent's `viewCount` is the sum of every view its chapters/episodes have
 * ever earned — /api/views increments the part AND the parent in one
 * transaction — so this figure and the per-part figures below always come from
 * the same ledger.
 */
export function useLiveCounts(
  collectionName: ContentCollection,
  id: string | null | undefined,
  initial: LiveCounts,
): LiveCounts {
  return useLiveDocCounts(id ? `${collectionName}/${id}` : null, initial)
}

/**
 * The same, for ONE chapter/episode document.
 *
 * The reader needs this: it loads the chapter, then /api/views records the open
 * a moment later, so the count fetched with the page is already out of date by
 * the time it paints. Listening means the reader sees the view they just earned
 * instead of a number that only moves on a hard refresh.
 */
export function useLivePartCounts(
  collectionName: ContentCollection,
  parentId: string | null | undefined,
  partId: string | null | undefined,
  initial: LiveCounts,
): LiveCounts {
  const path = parentId && partId
    ? `${collectionName}/${parentId}/${partCollection(collectionName)}/${partId}`
    : null
  return useLiveDocCounts(path, initial)
}
