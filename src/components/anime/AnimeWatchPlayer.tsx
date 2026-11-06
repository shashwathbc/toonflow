'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clapperboard, Loader2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { aspectCss } from '@/lib/anime/presets'
import { cn } from '@/lib/utils/cn'
import type { AnimeScene, AspectRatio } from '@/types/anime'

/**
 * Plays a published project's scenes back to back.
 *
 * There is no single composed file — the timeline render service isn't connected
 * — so the player treats the scene list as a PLAYLIST and advances through it,
 * which is a real viewing experience rather than a stand-in for one.
 *
 * Each clip is fetched as a short-lived signed URL from /api/anime/watch, which
 * re-checks publication server-side on every request. URLs are cached in memory
 * only and the next clip is pre-resolved during playback so the seam is silent.
 */
interface Resolved {
  url: string
  expiresAt: number
}

export default function AnimeWatchPlayer({
  projectId,
  scenes,
  aspectRatio,
  poster,
}: {
  projectId: string
  scenes: AnimeScene[]
  aspectRatio: AspectRatio
  poster: string | null
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [urls, setUrls] = useState<Record<string, Resolved>>({})
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const current = scenes[index]

  /**
   * Resolve one scene's playback URL, reusing a cached one while it's valid.
   *
   * A promise CHAIN rather than async/await: an awaited helper that calls
   * setState reads to the React Compiler as a synchronous setState inside the
   * effect below (react-hooks/set-state-in-effect). Chained, the writes clearly
   * happen in a callback.
   *
   * Depending on `urls` re-runs the effect whenever a URL resolves; the cache
   * check makes that pass a no-op.
   */
  const resolve = useCallback(
    (sceneId: string) => {
      const cached = urls[sceneId]
      if (cached && cached.expiresAt - Date.now() > 60_000) return
      fetch('/api/anime/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sceneId }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) {
            setError(typeof data?.error === 'string' ? data.error : 'This scene could not be loaded.')
            return
          }
          setUrls((prev) => ({ ...prev, [sceneId]: { url: data.url, expiresAt: data.expiresAt } }))
          setError(null)
        })
        .catch(() => setError('Network error — check your connection and try again.'))
    },
    [projectId, urls],
  )

  // Resolve the current clip, and pre-resolve the next one so the hand-off
  // between scenes doesn't stall on a round trip.
  useEffect(() => {
    if (!current) return
    resolve(current.id)
    const next = scenes[index + 1]
    if (next) resolve(next.id)
  }, [current, index, scenes, resolve])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (playing) void element.play().catch(() => setPlaying(false))
    else element.pause()
  }, [playing, index])

  const currentUrl = current ? urls[current.id]?.url : undefined
  const isLast = index >= scenes.length - 1

  if (scenes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-bg-border bg-bg-elevated text-text-muted"
        style={{ aspectRatio: aspectCss(aspectRatio) }}
      >
        <Clapperboard size={28} aria-hidden="true" />
        <p className="px-6 text-center text-sm">This title has no playable scenes yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: aspectCss(aspectRatio) }}
      >
        {currentUrl ? (
          <video
            ref={videoRef}
            key={current.id}
            src={currentUrl}
            poster={poster ?? undefined}
            controls
            playsInline
            preload="auto"
            className="h-full w-full object-contain"
            aria-label={`${current.title} — scene ${index + 1} of ${scenes.length}`}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              // Auto-advance through the playlist; stop cleanly at the end.
              if (!isLast) setIndex((i) => i + 1)
              else setPlaying(false)
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" role="status">
            {error ? (
              <p className="max-w-sm px-6 text-center text-sm text-danger">{error}</p>
            ) : (
              <>
                <Loader2
                  size={24}
                  className="animate-spin text-white/60 motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span className="sr-only">Loading scene…</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-full p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Previous scene"
        >
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full bg-accent p-2.5 text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(scenes.length - 1, i + 1))}
          disabled={isLast}
          className="rounded-full p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Next scene"
        >
          <SkipForward size={16} aria-hidden="true" />
        </button>
        <p className="ml-2 text-sm text-text-secondary" aria-live="polite">
          <span className="font-medium text-text">{current?.title}</span>
          <span className="ml-2 tabular-nums text-text-muted">
            {index + 1} / {scenes.length}
          </span>
        </p>
      </div>

      {/* Scene list — doubles as chapter navigation */}
      {scenes.length > 1 && (
        <nav className="mt-5" aria-label="Scenes">
          <ol className="flex gap-2 overflow-x-auto pb-2" role="list">
            {scenes.map((scene, i) => (
              <li key={scene.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'w-40 rounded-xl border p-2.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    i === index
                      ? 'border-studio-anime/45 bg-studio-anime/10'
                      : 'border-bg-border hover:bg-bg-elevated',
                  )}
                >
                  <span className="block text-[10px] font-semibold tabular-nums text-text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-text">{scene.title}</span>
                  <span className="mt-0.5 block text-[10px] tabular-nums text-text-muted">
                    {scene.durationSec.toFixed(1)}s
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  )
}
