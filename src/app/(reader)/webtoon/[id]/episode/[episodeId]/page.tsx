'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Home, List } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getWebtoonById, getEpisodesByWebtoon, upsertReadingHistory, getUserProfile } from '@/lib/firebase/firestore'
import { useViewTracking } from '@/hooks/useViewTracking'
import { useReaderChrome } from '@/hooks/useReaderChrome'
import { cn } from '@/lib/utils/cn'
import LikeButton from '@/components/reader/LikeButton'
import CommentSection from '@/components/reader/CommentSection'
import { EpisodeIntroPage } from '@/components/webtoon/EpisodeIntroPage'
import { EpisodeOutroPage } from '@/components/webtoon/EpisodeOutroPage'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Webtoon, Episode } from '@/types'

export default function EpisodeReaderPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>()
  const { firebaseUser } = useAuth()
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  // Author's CURRENT profile display name for the outro follow label — the
  // authorName denormalized on the webtoon doc can be stale after a rename.
  const [authorName, setAuthorName] = useState<string | null>(null)

  // Immersive chrome (top bar + floating episode nav) — hides while reading,
  // reveals on scroll-up or a tap. Shared with the novel chapter reader.
  const { chromeVisible, progress, handleSurfaceClick } = useReaderChrome()
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Width/valuenow set via the DOM: a11y linters reject JSX expressions in
  // aria-* and inline style attributes.
  useEffect(() => {
    const el = progressBarRef.current
    if (!el) return
    el.style.width = `${progress}%`
    el.setAttribute('aria-valuemin', '0')
    el.setAttribute('aria-valuemax', '100')
    el.setAttribute('aria-valuenow', String(Math.round(progress)))
  }, [progress])

  useEffect(() => {
    Promise.all([getWebtoonById(id), getEpisodesByWebtoon(id)])
      .then(([w, eps]) => {
        setWebtoon(w)
        const published = eps.filter((e) => e.status === 'published')
        published.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
        setEpisodes(published)
        setEpisode(published.find((e) => e.id === episodeId) ?? null)
        // Resolve the author's live profile name for the follow label.
        if (w?.authorId) {
          getUserProfile(w.authorId)
            .then((prof) => { if (prof?.displayName) setAuthorName(prof.displayName) })
            .catch(() => {})
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, episodeId])

  useViewTracking(episode ? { contentType: 'episode', contentId: episodeId, parentId: id } : null)

  useEffect(() => {
    if (!episode) return

    if (firebaseUser) {
      upsertReadingHistory(firebaseUser.uid, {
        contentId: id,
        contentType: 'webtoon',
        lastChapterId: episodeId,
        lastChapterNumber: episode.episodeNumber ?? 1,
      }).catch(() => {})
    }
  }, [episode, episodeId, id, firebaseUser])

  const currentIndex = episodes.findIndex((e) => e.id === episodeId)
  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null
  const nextEpisode = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  )

  if (!episode) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-text-muted gap-3">
      <ImageIcon size={40} className="opacity-30" />
      <p className="text-sm">Episode not found</p>
      <Link href={`/webtoon/${id}`} className="text-xs text-accent hover:underline">← Back to webtoon</Link>
    </div>
  )

  const panels: string[] = (episode.panels ?? []).map((p) =>
    typeof p === 'string' ? p : (p as { url?: string; imageUrl?: string }).url ?? (p as { url?: string; imageUrl?: string }).imageUrl ?? ''
  ).filter(Boolean)

  return (
    <div className="min-h-screen bg-black">
      {/* Reading progress bar (always visible, non-intrusive) */}
      <div
        ref={progressBarRef}
        className="reader-progress-bar"
        role="progressbar"
        aria-label="Reading progress"
      />

      {/* Immersive header — overlays the top of the strip and hides while reading */}
      <header
        className={cn(
          'reader-header fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/8',
          !chromeVisible && 'hidden'
        )}
        role="banner"
      >
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <Tooltip label="Back to webtoon" side="bottom">
            <Link
              href={`/webtoon/${id}`}
              className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded"
              aria-label="Back to webtoon"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              <List size={14} aria-hidden="true" />
            </Link>
          </Tooltip>

          <p className="text-xs font-medium text-white/70 truncate text-center">
            Ep. {episode.episodeNumber} · {episode.title}
          </p>

          <div className="flex items-center gap-1">
            <LikeButton contentType="episode" contentId={episodeId} parentId={id} initialCount={episode.likeCount ?? 0} size="sm" showCount={false} authorId={webtoon?.authorId} contentTitle={webtoon?.title} />
          </div>
        </div>
      </header>

      {/* Panels — vertical scroll webtoon format, always framed by the
          mandatory Toonflow intro and outro branding pages. Tapping the strip
          toggles the immersive chrome. */}
      <main id="main-content" className="max-w-2xl mx-auto" tabIndex={-1} onClick={handleSurfaceClick}>
        {webtoon && <EpisodeIntroPage webtoon={webtoon} episode={episode} />}

        {panels.length > 0 ? (
          <div className="flex flex-col">
            {panels.map((url, i) => (
              <div key={i} className="relative w-full">
                <Image
                  src={url}
                  alt={`Panel ${i + 1}`}
                  width={800}
                  height={1200}
                  className="w-full h-auto object-contain"
                  priority={i < 3}
                  loading={i >= 3 ? 'lazy' : 'eager'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-muted gap-3 px-4">
            <ImageIcon size={40} className="opacity-30" />
            <p className="text-sm">No panels in this episode yet</p>
          </div>
        )}

        {webtoon && <EpisodeOutroPage webtoon={webtoon} episode={episode} authorNameOverride={authorName ?? undefined} />}

        {/* Navigation */}
        <nav aria-label="Episode navigation" className="flex items-center justify-between gap-4 px-4 py-8 border-t border-bg-border">
          {prevEpisode ? (
            <Link href={`/webtoon/${id}/episode/${prevEpisode.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-elevated hover:bg-bg-card border border-bg-border text-sm text-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              <ChevronLeft size={15} aria-hidden="true" />
              Ep. {prevEpisode.episodeNumber}
            </Link>
          ) : (
            <Link href={`/webtoon/${id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-elevated hover:bg-bg-card border border-bg-border text-sm text-text-muted transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              <Home size={14} aria-hidden="true" /> Webtoon
            </Link>
          )}

          {nextEpisode ? (
            <Link href={`/webtoon/${id}/episode/${nextEpisode.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-accent text-sm">
              Ep. {nextEpisode.episodeNumber}
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          ) : (
            <Link href={`/webtoon/${id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-elevated hover:bg-bg-card border border-bg-border text-sm text-text-muted transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
              All Episodes <List size={14} aria-hidden="true" />
            </Link>
          )}
        </nav>

        {/* Comments */}
        <div className="border-t border-bg-border px-4 pt-8 pb-16">
          <CommentSection targetId={episodeId} targetType="episode" creatorId={webtoon?.authorId} contentTitle={webtoon?.title} contentLink={`/webtoon/${id}/episode/${episodeId}`} />
        </div>
      </main>

      {/* Floating episode nav — mirrors the novel reader; fades out with the
          chrome so the strip reads uninterrupted. Boundary sides render
          disabled (home links live in the inline end-of-episode nav above). */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 transition-all duration-300',
          chromeVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {prevEpisode ? (
          <Tooltip label="Previous episode" side="top">
            <Link
              href={`/webtoon/${id}/episode/${prevEpisode.id}`}
              className="w-10 h-10 rounded-full bg-black/70 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Previous episode"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Link>
          </Tooltip>
        ) : (
          <button
            type="button"
            disabled
            aria-label="No previous episode"
            className="w-10 h-10 rounded-full bg-black/70 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/60 opacity-40 cursor-not-allowed"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        )}

        <div className="px-4 py-2 rounded-full bg-black/70 border border-white/15 backdrop-blur-md text-[11px] text-white/50 font-medium tabular-nums">
          {Math.round(progress)}%
        </div>

        {nextEpisode ? (
          <Tooltip label="Next episode" side="top">
            <Link
              href={`/webtoon/${id}/episode/${nextEpisode.id}`}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Next episode"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Tooltip>
        ) : (
          <button
            type="button"
            disabled
            aria-label="No next episode"
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black opacity-40 cursor-not-allowed"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
