'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signSceneAsset } from '@/lib/anime/client'

/**
 * Resolve a private scene clip to a playable URL.
 *
 * Signed URLs are short-lived bearer credentials, so this hook treats them as
 * perishable: it caches one per scene in memory only, refreshes shortly BEFORE
 * expiry (a URL that dies mid-playback looks like a broken player), and never
 * writes one to storage or into a shareable link.
 *
 * All state is written from the request's `.then`, never synchronously in the
 * effect body — the visible values are derived from which scene the resolved
 * entry belongs to.
 */
const REFRESH_MARGIN_MS = 60_000

interface Resolved {
  sceneId: string
  url: string | null
  error: string | null
}

export interface UseSignedScene {
  url: string | null
  loading: boolean
  error: string | null
  /** Force a fresh URL — used after a regeneration replaces the bytes. */
  refresh: () => void
}

export function useSignedScene(
  projectId: string,
  sceneId: string | null,
  enabled: boolean,
): UseSignedScene {
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [nonce, setNonce] = useState(0)
  const cache = useRef<Map<string, { url: string; expiresAt: number }>>(new Map())

  const refresh = useCallback(() => {
    if (sceneId) cache.current.delete(sceneId)
    setNonce((n) => n + 1)
  }, [sceneId])

  useEffect(() => {
    if (!enabled || !sceneId) return

    const cached = cache.current.get(sceneId)
    if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      setResolved({ sceneId, url: cached.url, error: null })
      return
    }

    let active = true
    void signSceneAsset({ projectId, sceneId }).then((result) => {
      if (!active) return
      if (!result.ok) {
        // `not_generated` is an expected state, not a failure — the caller
        // renders its own empty state for it rather than an error banner.
        setResolved({
          sceneId,
          url: null,
          error: result.code === 'not_generated' ? null : result.error,
        })
        return
      }
      cache.current.set(sceneId, { url: result.url, expiresAt: result.expiresAt })
      setResolved({ sceneId, url: result.url, error: null })
    })

    return () => {
      active = false
    }
  }, [projectId, sceneId, enabled, nonce])

  const fresh = resolved?.sceneId === sceneId ? resolved : null

  return {
    url: fresh?.url ?? null,
    loading: enabled && !!sceneId && !fresh,
    error: fresh?.error ?? null,
    refresh,
  }
}
