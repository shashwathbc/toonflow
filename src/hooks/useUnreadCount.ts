'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'
import { useAuth } from '@/hooks/useAuth'

/**
 * Live total of unread messages across all of the signed-in user's
 * conversations, for the navbar badge. Uses a single `array-contains` listener
 * (no composite index needed) and sums each conversation's `unreadCount[uid]`.
 * Returns 0 when signed out.
 */
export function useUnreadCount(): number {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        let total = 0
        snap.forEach((d) => {
          total += (d.data().unreadCount?.[uid] as number | undefined) ?? 0
        })
        setCount(total)
      },
      (e) => console.error('[useUnreadCount] listener error:', e)
    )
    return () => unsub()
  }, [uid])

  // Derive so sign-out reads 0 without a synchronous setState in the effect.
  return uid ? count : 0
}
