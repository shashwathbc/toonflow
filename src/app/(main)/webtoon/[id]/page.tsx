'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ImageIcon, Eye, Heart, Users, Star, ChevronRight,
  Loader2, Clock, Play,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getWebtoonById, getEpisodesByWebtoon, followUser, unfollowUser, isFollowing } from '@/lib/firebase/firestore'
import { formatCount, formatDate } from '@/lib/utils/formatters'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import { cn } from '@/lib/utils/cn'
import type { Webtoon, Episode } from '@/types'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ongoing:   { label: 'Ongoing',   color: 'bg-accent/10 text-accent border-accent/20' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  hiatus:    { label: 'Hiatus',    color: 'bg-warning/10 text-warning border-warning/20' },
  draft:     { label: 'Draft',     color: 'bg-bg-elevated text-text-muted border-bg-border' },
  published: { label: 'Published', color: 'bg-accent/10 text-accent border-accent/20' },
}

export default function WebtoonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { firebaseUser } = useAuth()
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)

  useEffect(() => {
    Promise.all([getWebtoonById(id), getEpisodesByWebtoon(id)])
      .then(([w, eps]) => {
        setWebtoon(w)
        const published = eps.filter((e) => e.status === 'published')
        published.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
        setEpisodes(published)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!firebaseUser || !webtoon) return
    isFollowing(firebaseUser.uid, webtoon.authorId).then(setFollowing).catch(() => {})
  }, [firebaseUser, webtoon])

  const handleFollow = async () => {
    if (!firebaseUser || !webtoon || followLoading) return
    setFollowLoading(true)
    const prev = following
    setFollowing(!prev)
    try {
      if (prev) await unfollowUser(firebaseUser.uid, webtoon.authorId)
      else await followUser(firebaseUser.uid, webtoon.authorId)
    } catch {
      setFollowing(prev)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="w-44 aspect-[2/3] rounded-2xl bg-bg-elevated flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-64 bg-bg-elevated rounded" />
          <div className="h-4 w-32 bg-bg-elevated rounded" />
          <div className="h-4 w-full bg-bg-elevated rounded" />
        </div>
      </div>
    </div>
  )

  if (!webtoon) return (
    <div className="flex flex-col items-center justify-center h-96 text-text-muted gap-3">
      <ImageIcon size={40} className="opacity-30" />
      <p className="text-sm">Webtoon not found</p>
      <Link href="/browse" className="text-xs text-accent hover:underline">Browse content →</Link>
    </div>
  )

  const badge = STATUS_BADGE[webtoon.status] ?? STATUS_BADGE.ongoing
  const synopsis = webtoon.synopsis ?? ''
  const showExpand = synopsis.length > 280
  const displaySynopsis = showExpand && !synopsisExpanded ? synopsis.slice(0, 280) + '…' : synopsis
  const firstEpisode = episodes[0]

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-40 sm:w-48 aspect-[2/3] rounded-2xl bg-bg-elevated flex-shrink-0 overflow-hidden shadow-xl self-start">
          {webtoon.coverURL
            ? <Image src={webtoon.coverURL} alt={webtoon.title} width={192} height={288} className="object-cover w-full h-full" />
            : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={32} className="text-text-muted" /></div>
          }
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <span className={cn('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border mb-2', badge.color)}>
              {badge.label}
            </span>
            <h1 className="text-2xl font-bold text-text leading-tight">{webtoon.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Link href={`/profile/${webtoon.authorId}`} className="text-sm text-text-secondary hover:text-accent transition-colors">
                by {webtoon.authorName}
              </Link>
              {firebaseUser && firebaseUser.uid !== webtoon.authorId && (
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    following
                      ? 'border-accent/30 text-accent bg-accent/10'
                      : 'border-bg-border text-text-muted hover:border-accent/20 hover:text-text'
                  )}
                >
                  <Users size={10} aria-hidden="true" />
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          {webtoon.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {webtoon.genres.map((g) => (
                <Link key={g} href={`/browse?genre=${g}`} className="text-[11px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted hover:text-text hover:bg-bg-card transition-colors capitalize">
                  {g}
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1"><Eye size={13} aria-hidden="true" /> {formatCount(webtoon.viewCount ?? 0)} views</span>
            <span className="flex items-center gap-1"><Heart size={13} aria-hidden="true" /> {formatCount(webtoon.likeCount ?? 0)} likes</span>
            <span className="flex items-center gap-1"><ImageIcon size={13} aria-hidden="true" /> {webtoon.episodeCount ?? episodes.length} episodes</span>
            {(webtoon.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1"><Star size={13} className="text-warning" aria-hidden="true" /> {(webtoon.rating ?? 0).toFixed(1)}</span>
            )}
          </div>

          <div>
            <p className="text-sm text-text-secondary leading-relaxed">{displaySynopsis}</p>
            {showExpand && (
              <button type="button" onClick={() => setSynopsisExpanded((v) => !v)} className="text-xs text-accent hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded">
                {synopsisExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {firstEpisode ? (
              <Link href={`/webtoon/${id}/episode/${firstEpisode.id}`} className="btn-accent flex items-center gap-2 text-sm">
                <Play size={14} aria-hidden="true" /> Read Episode 1
              </Link>
            ) : (
              <button type="button" disabled className="btn-accent text-sm opacity-50">No episodes yet</button>
            )}
            <LikeButton contentType="webtoon" contentId={id} initialCount={webtoon.likeCount ?? 0} />
            <BookmarkButton contentId={id} contentType="webtoon" showLabel />
          </div>
        </div>
      </div>

      {/* Episode grid */}
      <section aria-labelledby="episodes-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="episodes-heading" className="text-lg font-bold text-text flex items-center gap-2">
            <ImageIcon size={16} aria-hidden="true" /> Episodes
            <span className="text-sm font-normal text-text-muted">({episodes.length})</span>
          </h2>
        </div>

        {episodes.length === 0 ? (
          <div className="text-center py-12 bg-bg-card border border-bg-border rounded-2xl text-text-muted">
            <Clock size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No episodes published yet</p>
          </div>
        ) : (
          <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
            {episodes.map((ep, i) => (
              <Link
                key={ep.id}
                href={`/webtoon/${id}/episode/${ep.id}`}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/40 transition-colors group"
              >
                {ep.thumbnailURL ? (
                  <div className="w-12 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={ep.thumbnailURL} alt="" width={48} height={56} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="w-12 h-14 rounded-lg bg-bg-elevated flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-text-muted">{ep.episodeNumber ?? i + 1}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate">
                    Ep. {ep.episodeNumber ?? i + 1} · {ep.title || `Episode ${ep.episodeNumber ?? i + 1}`}
                  </p>
                  <p className="text-xs text-text-muted">{ep.panels?.length ?? 0} panels</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-text-muted">
                  {(ep.viewCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1"><Eye size={11} aria-hidden="true" /> {formatCount(ep.viewCount ?? 0)}</span>
                  )}
                  {ep.publishedAt && <span>{formatDate(ep.publishedAt)}</span>}
                  <ChevronRight size={14} className="group-hover:text-accent transition-colors" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
