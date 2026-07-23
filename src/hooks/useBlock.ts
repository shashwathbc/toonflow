'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { blockUser, unblockUser, isBlocked } from '@/lib/firebase/blocks'

export interface UseBlockResult {
  /** Viewer has blocked the target. */
  blocked: boolean
  pending: boolean
  canBlock: boolean
  /** Toggle block state; resolves to the new value, or null if rejected/rolled back. */
  toggle: () => Promise<boolean | null>
}

/** Block/unblock a user with optimistic UI + an in-flight guard. */
export function useBlock(targetUid: string | null | undefined): UseBlockResult {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null
  const [blocked, setBlocked] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const canBlock = !!uid && !!targetUid && uid !== targetUid

  useEffect(() => {
    if (!uid || !targetUid || uid === targetUid) return
    let cancelled = false
    isBlocked(uid, targetUid)
      .then((v) => { if (!cancelled) setBlocked(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid, targetUid])

  const toggle = useCallback(async (): Promise<boolean | null> => {
    if (!uid || !targetUid || uid === targetUid || inFlight.current) return null
    inFlight.current = true
    setPending(true)
    const prev = blocked
    const next = !prev
    setBlocked(next)
    try {
      if (next) await blockUser(uid, targetUid)
      else await unblockUser(uid, targetUid)
      return next
    } catch (e) {
      setBlocked(prev)
      console.error('[useBlock] toggle failed:', e)
      return null
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [uid, targetUid, blocked])

  return { blocked, pending, canBlock, toggle }
}
