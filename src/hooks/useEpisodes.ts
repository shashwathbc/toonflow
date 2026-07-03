'use client'

import { useEffect, useState } from 'react'
import { subscribeToEpisodes } from '@/lib/firebase/firestore'
import type { Episode } from '@/types'

export function useEpisodes(webtoonId: string) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [error, setError] = useState<string | null>(null)
  // loading derives from "has the current webtoonId received its first snapshot",
  // so the effect never calls setState synchronously
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (!webtoonId) return

    const unsub = subscribeToEpisodes(
      webtoonId,
      (data) => {
        setEpisodes(data)
        setLoadedId(webtoonId)
      },
      (err) => {
        setError(err.message)
        setLoadedId(webtoonId)
      }
    )

    return unsub
  }, [webtoonId])

  return { episodes, loading: !!webtoonId && loadedId !== webtoonId, error }
}
