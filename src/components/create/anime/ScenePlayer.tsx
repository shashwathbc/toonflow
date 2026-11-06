'use client'

import { useEffect, useRef } from 'react'
import { Clapperboard, Loader2 } from 'lucide-react'
import { useSignedScene } from '@/hooks/useSignedScene'
import { aspectCss } from '@/lib/anime/presets'
import type { AnimeScene } from '@/types/anime'

/**
 * Plays a generated clip, or shows the honest reason there isn't one.
 *
 * A scene without `storageKey` has genuinely never been generated. This renders
 * that as an explicit empty frame — never a stock loop or a poster standing in
 * for a video that doesn't exist.
 */
export default function ScenePlayer({
  projectId,
  scene,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
}: {
  projectId: string
  scene: AnimeScene
  className?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
}) {
  const hasClip = scene.status === 'ready' && Boolean(scene.storageKey)
  const { url, loading, error, refresh } = useSignedScene(projectId, scene.id, hasClip)
  const videoRef = useRef<HTMLVideoElement>(null)

  // A signed URL can expire between render and playback. When the element
  // errors, ask for a fresh one exactly once per URL instead of surfacing a
  // dead player.
  const retried = useRef<string | null>(null)
  useEffect(() => {
    retried.current = null
  }, [url])

  const ratio = aspectCss(scene.settings.aspectRatio)

  if (!hasClip) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bg-border bg-bg-elevated text-text-muted ${className ?? ''}`}
        style={{ aspectRatio: ratio }}
      >
        <Clapperboard size={24} aria-hidden="true" />
        <p className="px-4 text-center text-xs">
          {scene.status === 'failed'
            ? 'Generation failed — try again'
            : scene.status === 'processing' || scene.status === 'queued'
              ? 'Generating…'
              : 'Not generated yet'}
        </p>
      </div>
    )
  }

  if (loading || (!url && !error)) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-bg-elevated ${className ?? ''}`}
        style={{ aspectRatio: ratio }}
        role="status"
        aria-label="Loading clip"
      >
        <Loader2 size={20} className="animate-spin text-text-muted motion-reduce:animate-none" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-danger/25 bg-danger/10 px-4 text-center text-xs text-danger ${className ?? ''}`}
        style={{ aspectRatio: ratio }}
        role="alert"
      >
        {error}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      src={url ?? undefined}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop
      playsInline
      preload="metadata"
      className={`w-full rounded-xl bg-black ${className ?? ''}`}
      style={{ aspectRatio: ratio }}
      aria-label={`Generated clip for ${scene.title}`}
      onError={() => {
        if (url && retried.current !== url) {
          retried.current = url
          refresh()
        }
      }}
    />
  )
}
