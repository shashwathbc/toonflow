'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BookOpen, Eye, Heart, Users,
  Star, ChevronRight, Loader2, Clock, BookMarked,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useChapters } from '@/hooks/useChapters'
import { getNovelById, followUser, unfollowUser, isFollowing } from '@/lib/firebase/firestore'
import { formatCount, formatDate } from '@/lib/utils/formatters'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import { cn } from '@/lib/utils/cn'
import type { Novel } from '@/types'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ongoing:   { label: 'Ongoing',   color: 'bg-accent/10 text-accent border-accent/20' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  hiatus:    { label: 'Hiatus',    color: 'bg-warning/10 text-warning border-warning/20' },
  draft:     { label: 'Draft',     color: 'bg-bg-elevated text-text-muted border-bg-border' },
  published: { label: 'Published', color: 'bg-accent/10 text-accent border-accent/20' },
}

export default function NovelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { firebaseUser } = useAuth()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [novelLoading, setNovelLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Real-time chapter listener — updates immediately when chapters are published
  const { chapters: allChapters, loading: chaptersLoading } = useChapters(id)
  const chapters = allChapters
    .filter((ch) => ch.status === 'published')
    .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))

  useEffect(() => {
    setNovelLoading(true)
    getNovelById(id)
      .then(setNovel)
      .catch(console.error)
      .finally(() => setNovelLoading(false))
  }, [id])

  useEffect(() => {
    if (!firebaseUser || !novel) return
    isFollowing(firebaseUser.uid, novel.authorId).then(setFollowing).catch(() => {})
  }, [firebaseUser, novel])

  const handleFollow = async () => {
    if (!firebaseUser || !novel || followLoading) return
    setFollowLoading(true)
    const prev = following
    setFollowing(!prev)
    try {
      if (prev) await unfollowUser(firebaseUser.uid, novel.authorId)
      else await followUser(firebaseUser.uid, novel.authorId)
    } catch {
      setFollowing(prev)
    } finally {
      setFollowLoading(false)
    }
  }

  if (novelLoading) return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="w-44 aspect-[2/3] rounded-2xl bg-bg-elevated flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-64 bg-bg-elevated rounded" />
          <div className="h-4 w-32 bg-bg-elevated rounded" />
          <div className="h-4 w-full bg-bg-elevated rounded" />
          <div className="h-4 w-5/6 bg-bg-elevated rounded" />
        </div>
      </div>
    </div>
  )

  if (!novel) return (
    <div className="flex flex-col items-center justify-center h-96 text-text-muted gap-3">
      <BookOpen size={40} className="opacity-30" />
      <p className="text-sm">Novel not found</p>
      <Link href="/browse" className="text-xs text-accent hover:underline">Browse content →</Link>
    </div>
  )

  const badge = STATUS_BADGE[novel.status] ?? STATUS_BADGE.ongoing
  const synopsis = novel.synopsis ?? ''
  const showExpand = synopsis.length > 280
  const displaySynopsis = showExpand && !synopsisExpanded ? synopsis.slice(0, 280) + '…' : synopsis
  const firstChapter = chapters[0]

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Cover */}
        <div className="w-40 sm:w-48 aspect-[2/3] rounded-2xl bg-bg-elevated flex-shrink-0 overflow-hidden shadow-xl self-start">
          {novel.coverURL
            ? <Image src={novel.coverURL} alt={novel.title} width={192} height={288} className="object-cover w-full h-full" />
            : <div className="w-full h-full flex items-center justify-center"><BookOpen size={32} className="text-text-muted" /></div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <span className={cn('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border mb-2', badge.color)}>
              {badge.label}
            </span>
            <h1 className="text-2xl font-bold text-text leading-tight">{novel.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Link
                href={`/profile/${novel.authorId}`}
                className="text-sm text-text-secondary hover:text-accent transition-colors"
              >
                by {novel.authorName}
              </Link>
              {firebaseUser && firebaseUser.uid !== novel.authorId && (
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

          {/* Genres */}
          {novel.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {novel.genres.map((g) => (
                <Link
                  key={g}
                  href={`/browse?genre=${g}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted hover:text-text hover:bg-bg-card transition-colors capitalize"
                >
                  {g}
                </Link>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1">
              <Eye size={13} aria-hidden="true" /> {formatCount(novel.viewCount ?? 0)} views
            </span>
            <span className="flex items-center gap-1">
              <Heart size={13} aria-hidden="true" /> {formatCount(novel.likeCount ?? 0)} likes
            </span>
            <span className="flex items-center gap-1">
              <BookOpen size={13} aria-hidden="true" /> {chapters.length} chapters
            </span>
            {(novel.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Star size={13} aria-hidden="true" className="text-warning" />
                {(novel.rating ?? 0).toFixed(1)}
              </span>
            )}
          </div>

          {/* Synopsis */}
          <div>
            <p className="text-sm text-text-secondary leading-relaxed">{displaySynopsis}</p>
            {showExpand && (
              <button
                type="button"
                onClick={() => setSynopsisExpanded((v) => !v)}
                className="text-xs text-accent hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
              >
                {synopsisExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {firstChapter ? (
              <Link
                href={`/novel/${id}/chapter/${firstChapter.id}`}
                className="btn-accent flex items-center gap-2 text-sm"
              >
                <BookOpen size={14} aria-hidden="true" /> Start Reading
              </Link>
            ) : (
              <button type="button" disabled className="btn-accent text-sm opacity-50">No chapters yet</button>
            )}
            <LikeButton contentType="novel" contentId={id} initialCount={novel.likeCount ?? 0} />
            <BookmarkButton contentId={id} contentType="novel" showLabel />
          </div>
        </div>
      </div>

      {/* Chapter list */}
      <section aria-labelledby="chapters-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="chapters-heading" className="text-lg font-bold text-text flex items-center gap-2">
            <BookMarked size={16} aria-hidden="true" /> Chapters
            {chaptersLoading
              ? <Loader2 size={13} className="animate-spin text-text-muted" aria-hidden="true" />
              : <span className="text-sm font-normal text-text-muted">({chapters.length})</span>
            }
          </h2>
          {chapters.length > 0 && (
            <span className="text-xs text-text-muted">
              ~{Math.ceil(chapters.reduce((s, c) => s + (c.wordCount ?? 0), 0) / 200).toLocaleString()} min total
            </span>
          )}
        </div>

        {!chaptersLoading && chapters.length === 0 ? (
          <div className="text-center py-14 bg-bg-card border border-bg-border rounded-2xl text-text-muted">
            <Clock size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No chapters published yet</p>
            <p className="text-xs mt-1 opacity-60">Check back soon</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden border border-bg-border divide-y divide-bg-border/50">
              {(showAll ? chapters : chapters.slice(0, 20)).map((ch, i) => {
                const readingMin = ch.wordCount > 0 ? Math.ceil(ch.wordCount / 200) : null
                return (
                  <Link
                    key={ch.id}
                    href={`/novel/${id}/chapter/${ch.id}`}
                    className="flex items-center gap-4 px-5 py-4 bg-bg-card hover:bg-bg-elevated transition-colors group"
                    aria-label={`Read chapter ${ch.chapterNumber}: ${ch.title || 'Untitled'}`}
                  >
                    {/* Chapter number */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-bg-elevated group-hover:bg-accent group-hover:text-accent-foreground flex items-center justify-center transition-colors">
                      <span className="text-xs font-bold text-text-muted group-hover:text-accent-foreground tabular-nums">
                        {ch.chapterNumber ?? i + 1}
                      </span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text group-hover:text-accent transition-colors truncate leading-tight">
                        {ch.title || `Chapter ${ch.chapterNumber ?? i + 1}`}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {readingMin && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <BookOpen size={10} aria-hidden="true" />
                            {ch.wordCount.toLocaleString()} words · {readingMin} min
                          </span>
                        )}
                        {ch.publishedAt && (
                          <span className="text-[11px] text-text-muted">
                            {formatDate(ch.publishedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right stats */}
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-text-muted">
                      {(ch.viewCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Eye size={11} aria-hidden="true" /> {formatCount(ch.viewCount)}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-text-muted/40 group-hover:text-accent transition-colors" aria-hidden="true" />
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Show more / show less */}
            {chapters.length > 20 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full mt-2 py-3 text-sm text-text-muted hover:text-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-xl"
              >
                {showAll
                  ? `Show fewer chapters`
                  : `Show all ${chapters.length} chapters`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
