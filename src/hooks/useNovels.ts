'use client'

import { useEffect, useState } from 'react'
import { subscribeToNovels } from '@/lib/firebase/firestore'
import type { Novel } from '@/types'

export function useNovels(uid: string) {
  const [novels, setNovels] = useState<Novel[]>([])
  const [error, setError] = useState<string | null>(null)
  // loading derives from "has the current uid received its first snapshot",
  // so the effect never calls setState synchronously
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const unsub = subscribeToNovels(
      uid,
      (data) => {
        setNovels(data)
        setLoadedUid(uid)
      },
      (err) => {
        setError(err.message)
        setLoadedUid(uid)
      }
    )

    return unsub
  }, [uid])

  return { novels, loading: !!uid && loadedUid !== uid, error }
}
