'use client'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'
import { useAuth } from '@/hooks/useAuth'
import type { AppNotification } from '@/types'

const FEED_LIMIT = 30

export interface UseNotificationsResult {
  notifications: AppNotification[]
  /** Count of unread items in the loaded window (display caps at 9+ anyway). */
  unreadCount: number
  loading: boolean
}

/**
 * Live feed of the signed-in user's most recent notifications, newest first,
 * for the navbar bell. A single `createdAt desc` listener (single-field index)
 * powers both the dropdown list and the unread badge. Returns an empty feed
 * when signed out (derived, so sign-out never triggers a setState-in-effect).
 */
export function useNotifications(): UseNotificationsResult {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(FEED_LIMIT),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) })))
        setLoading(false)
      },
      (e) => {
        console.error('[useNotifications] listener error:', e)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [uid])

  const notifications = uid ? items : []
  const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0)

  return { notifications, unreadCount, loading: uid ? loading : false }
}
