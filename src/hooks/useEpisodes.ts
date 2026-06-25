'use client'

import { useEffect, useState } from 'react'
import { subscribeToEpisodes } from '@/lib/firebase/firestore'
import type { Episode } from '@/types'

export function useEpisodes(webtoonId: string) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!webtoonId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeToEpisodes(
      webtoonId,
      (data) => {
        setEpisodes(data)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [webtoonId])

  return { episodes, loading, error }
}
