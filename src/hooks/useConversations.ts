'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/db'
import { getUserProfile } from '@/lib/firebase/firestore'
import type { Conversation, UserProfile } from '@/types'

export interface ConversationRow {
  conversation: Conversation
  otherUid: string
  /** Hydrated profile of the other participant (null while loading / deleted). */
  other: UserProfile | null
  unread: number
}

const PAGE = 20

export interface UseConversationsResult {
  rows: ConversationRow[]
  loading: boolean
  hasMore: boolean
  loadMore: () => void
}

/**
 * Real-time inbox: the signed-in user's conversations ordered by `updatedAt`
 * (newest first, so a thread jumps to the top when a message arrives). Grows
 * the window via `loadMore` (re-subscribe). The other participant's profile is
 * fetched once per uid and cached. Requires the composite index
 * (participants array-contains + updatedAt desc).
 */
export function useConversations(uid: string | null): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null>>({})
  const [pageLimit, setPageLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const profilesRef = useRef<Record<string, UserProfile | null>>({})

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      limit(pageLimit)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const convs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversation, 'id'>) }))
        setConversations(convs)
        setHasMore(convs.length === pageLimit)
        setLoading(false)

        // Hydrate any not-yet-seen participant profiles (once each).
        for (const c of convs) {
          const other = c.participants.find((p) => p !== uid)
          if (!other || other in profilesRef.current) continue
          profilesRef.current[other] = null // reserve to dedupe concurrent fetches
          getUserProfile(other)
            .then((p) => {
              profilesRef.current[other] = p
              setProfiles({ ...profilesRef.current })
            })
            .catch((e) => console.error('[useConversations] profile fetch failed:', e))
        }
      },
      (e) => {
        console.error('[useConversations] listener error:', e)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [uid, pageLimit])

  const rows: ConversationRow[] = conversations.map((c) => {
    const otherUid = c.participants.find((p) => p !== uid) ?? ''
    return {
      conversation: c,
      otherUid,
      other: profiles[otherUid] ?? null,
      unread: (uid ? c.unreadCount?.[uid] : 0) ?? 0,
    }
  })

  const loadMore = useCallback(() => setPageLimit((l) => l + PAGE), [])

  return { rows, loading: uid ? loading : false, hasMore, loadMore }
}
