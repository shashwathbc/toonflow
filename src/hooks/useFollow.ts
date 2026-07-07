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
export function useFollow(targetUid: string | null | undefined): UseFollowResult {
  const { firebaseUser } = useAuth()
  const [following, setFollowing] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const uid = firebaseUser?.uid ?? null
  const isSelf = !!uid && uid === targetUid
  const canFollow = !!uid && !!targetUid && !isSelf

  useEffect(() => {
    if (!uid || !targetUid || uid === targetUid) return
    let cancelled = false
    isFollowing(uid, targetUid)
      .then((v) => { if (!cancelled) setFollowing(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid, targetUid])

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
