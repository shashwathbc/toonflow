'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Home, List } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getWebtoonById, getEpisodesByWebtoon, upsertReadingHistory } from '@/lib/firebase/firestore'
import { trackView } from '@/lib/firebase/engagement'
import LikeButton from '@/components/reader/LikeButton'
import CommentSection from '@/components/reader/CommentSection'
import type { Webtoon, Episode } from '@/types'

export default function EpisodeReaderPage() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>()
  const { firebaseUser } = useAuth()
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const viewTracked = useRef(false)

  useEffect(() => {
    Promise.all([getWebtoonById(id), getEpisodesByWebtoon(id)])
      .then(([w, eps]) => {
        setWebtoon(w)
        const published = eps.filter((e) => e.status === 'published')
        published.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
        setEpisodes(published)
        setEpisode(published.find((e) => e.id === episodeId) ?? null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, episodeId])

  useEffect(() => {
    if (!episode || viewTracked.current) return
    viewTracked.current = true

    trackView(episodeId, 'episode', id, firebaseUser?.uid ?? null).catch(() => {})

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
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-bg-border">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <Link
            href={`/webtoon/${id}`}
            className="flex items-center gap-1 text-text-muted hover:text-text text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
            aria-label="Back to webtoon"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            <List size={14} aria-hidden="true" />
          </Link>

          <p className="text-xs font-medium text-text truncate text-center">
            Ep. {episode.episodeNumber} · {episode.title}
          </p>

          <LikeButton contentType="episode" contentId={episodeId} parentId={id} initialCount={episode.viewCount ?? 0} size="sm" showCount={false} />
        </div>
      </header>

      {/* Panels — vertical scroll webtoon format */}
      <main id="main-content" className="max-w-2xl mx-auto" tabIndex={-1}>
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
          <CommentSection targetId={episodeId} targetType="episode" creatorId={webtoon?.authorId} />
        </div>
      </main>
    </div>
  )
}
