'use client'

import { useEffect, useState } from 'react'
import { subscribeToCharacters } from '@/lib/firebase/firestore'
import type { Character } from '@/types'

/** Live per-webtoon character roster. Empty until a webtoonId is available. */
export function useCharacters(webtoonId: string | undefined) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (!webtoonId) return
    const unsub = subscribeToCharacters(
      webtoonId,
      (data) => {
        setCharacters(data)
        setLoadedId(webtoonId)
      },
      (err) => {
        setError(err.message)
        setLoadedId(webtoonId)
      }
    )
    return unsub
  }, [webtoonId])

  return { characters, loading: !!webtoonId && loadedId !== webtoonId, error }
}
