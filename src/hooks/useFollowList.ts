'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { getFollowConnections, type FollowListType } from '@/lib/firebase/social'
import type { SocialUser } from '@/types'

export interface UseFollowListResult {
  users: SocialUser[]
  /** First page is loading (skeletons). */
  loading: boolean
  /** A subsequent page is loading (spinner at the bottom). */
  loadingMore: boolean
  /** More pages remain. */
  hasMore: boolean
  /** The initial load failed — show an error state + Retry. */
  error: boolean
  loadMore: () => void
  retry: () => void
}

/**
 * Paginated loader for a profile's followers or following list. Reads 20 rows
 * per page from the public `users/{uid}/{type}` subcollection (see
 * getFollowConnections) with cursor-based paging. Resets and reloads whenever
 * the profile or tab changes; a generation guard discards responses from a page
 * that a newer reset has superseded (out-of-order safety).
 *
 * Search / sort / friends-only are applied by the consumer over `users`
 * (client-side, over loaded rows — Instagram-like).
 */
export function useFollowList({
  profileUid,
  type,
  viewerId,
  enabled = true,
}: {
  profileUid: string
  type: FollowListType
  viewerId?: string | null
  enabled?: boolean
}): UseFollowListResult {
  const key = `${profileUid}|${type}`

  // Users are stored WITH the key they belong to, so a tab switch derives an
  // empty list immediately (no stale rows, no synchronous setState in effect).
  const [data, setData] = useState<{ key: string; users: SocialUser[] }>({ key: '', users: [] })
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const genRef = useRef(0)
  const inFlight = useRef(false)

  const users = data.key === key ? data.users : []
  const loading = enabled && loadedKey !== key

  // Core fetch. Deliberately performs NO synchronous setState (all updates run
  // inside the promise chain) so it's safe to invoke from an effect without
  // triggering cascading renders — the spinner state for "more" is set by the
  // user-invoked `loadMore` wrapper below instead.
  const runLoad = useCallback(
    (mode: 'reset' | 'more') => {
      if (!enabled) return
      if (mode === 'more' && (inFlight.current || !cursorRef.current)) return
      if (mode === 'reset') {
        genRef.current += 1
        cursorRef.current = null
      }
      const myGen = genRef.current
      const cursor = mode === 'reset' ? null : cursorRef.current
      inFlight.current = true

      getFollowConnections({ profileUid, type, viewerId, cursor })
        .then((page) => {
          if (myGen !== genRef.current) return // superseded by a newer reset
          cursorRef.current = page.nextCursor
          setHasMore(page.hasMore)
          setError(false)
          setData((prev) => ({
            key,
            users: mode === 'reset' ? page.users : [...(prev.key === key ? prev.users : []), ...page.users],
          }))
        })
        .catch((e) => {
          if (myGen !== genRef.current) return
          console.error('[useFollowList] load failed:', e)
          setError(true)
        })
        .finally(() => {
          if (myGen !== genRef.current) return
          inFlight.current = false
          setLoadingMore(false)
          setLoadedKey(key)
        })
    },
    [profileUid, type, viewerId, enabled, key]
  )

  // Reset + load page 1 whenever the profile/tab/viewer changes or the dialog
  // opens. `runLoad` mutates only refs synchronously; state updates are async.
  useEffect(() => {
    runLoad('reset')
  }, [runLoad])

  const loadMore = useCallback(() => {
    if (!enabled || inFlight.current || !cursorRef.current) return
    setLoadingMore(true)
    runLoad('more')
  }, [runLoad, enabled])

  return {
    users,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry: useCallback(() => runLoad('reset'), [runLoad]),
  }
}
