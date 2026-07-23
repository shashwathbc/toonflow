'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { followUser, unfollowUser, isFollowing } from '@/lib/firebase/firestore'

export interface UseFollowResult {
  /** Current (optimistic) subscription state. */
  following: boolean
  /** A toggle request is in flight. */
  pending: boolean
  /** Signed in and not the creator themselves. */
  canFollow: boolean
  /** Viewer is looking at their own authored content/profile. */
  isSelf: boolean
  signedIn: boolean
  /**
   * Optimistically toggles the subscription. Resolves to the new state, or
   * null when the request was rejected (not signed in / duplicate in flight)
   * or rolled back on error.
   */
  toggle: () => Promise<boolean | null>
}

/**
 * Subscribe/unsubscribe to a creator with optimistic UI and duplicate-request
 * protection. The underlying service runs a Firestore transaction, so even a
 * request that slips past the in-flight guard can never double-count.
 */
export function useFollow(
  targetUid: string | null | undefined,
  options?: {
    /**
     * Seed the follow state instead of fetching it. Pass this from a list that
     * already knows the relationship (e.g. a followers modal) so N rows don't
     * fire N `isFollowing` reads on mount.
     */
    initialFollowing?: boolean
  }
): UseFollowResult {
  const { firebaseUser } = useAuth()
  const seeded = options?.initialFollowing
  const [following, setFollowing] = useState(seeded ?? false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const uid = firebaseUser?.uid ?? null
  const isSelf = !!uid && uid === targetUid
  const canFollow = !!uid && !!targetUid && !isSelf

  useEffect(() => {
    // Caller supplied the state — trust it and skip the network read.
    if (seeded !== undefined) return
    if (!uid || !targetUid || uid === targetUid) return
    let cancelled = false
    isFollowing(uid, targetUid)
      .then((v) => { if (!cancelled) setFollowing(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid, targetUid, seeded])

  const toggle = useCallback(async (): Promise<boolean | null> => {
    if (!uid || !targetUid || uid === targetUid) return null
    if (inFlight.current) return null // spam guard — one request at a time
    inFlight.current = true
    setPending(true)

    const prev = following
    const next = !prev
    setFollowing(next) // optimistic
    try {
      if (next) await followUser(uid, targetUid)
      else await unfollowUser(uid, targetUid)
      return next
    } catch (err) {
      setFollowing(prev) // roll back
      console.error('[useFollow] toggle failed:', err)
      return null
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [uid, targetUid, following])

  return { following, pending, canFollow, isSelf, signedIn: !!uid, toggle }
}
