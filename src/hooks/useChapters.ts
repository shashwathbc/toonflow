'use client'

import { useEffect, useState } from 'react'
import { subscribeToChapters } from '@/lib/firebase/firestore'
import type { Chapter } from '@/types'

export function useChapters(novelId: string) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [error, setError] = useState<string | null>(null)
  // loading derives from "has the current novelId received its first snapshot",
  // so the effect never calls setState synchronously
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (!novelId) return

    const unsub = subscribeToChapters(
      novelId,
      (data) => {
        setChapters(data)
        setLoadedId(novelId)
      },
      (err) => {
        setError(err.message)
        setLoadedId(novelId)
      }
    )

    return unsub
  }, [novelId])

  return { chapters, loading: !!novelId && loadedId !== novelId, error }
}
