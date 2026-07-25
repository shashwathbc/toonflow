'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BookOpen, Eye, Star, ChevronRight, Loader2, Clock,
  Activity, Hash, Calendar, ArrowUpDown, Search, ChevronsRight,
} from 'lucide-react'
import { useChapters } from '@/hooks/useChapters'
import { useLiveViewCount } from '@/hooks/useLiveViewCount'
import { getNovelById } from '@/lib/firebase/firestore'
import { formatCount, formatDate, fromTimestamp } from '@/lib/utils/formatters'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import RatingControl from '@/components/reader/RatingControl'
import AuthorCard from '@/components/social/AuthorCard'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel } from '@/types'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ongoing:   { label: 'Ongoing',   color: 'bg-accent/15 text-accent border-accent/30' },
  completed: { label: 'Completed', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  hiatus:    { label: 'Hiatus',    color: 'bg-warning/15 text-warning border-warning/30' },
  draft:     { label: 'Draft',     color: 'bg-bg-elevated text-text-muted border-bg-border' },
  published: { label: 'Published', color: 'bg-accent/15 text-accent border-accent/30' },
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          aria-hidden="true"
          className={s <= Math.round(rating) ? 'text-warning fill-warning' : 'text-text-muted/40'}
        />
      ))}
    </span>
  )
}

function DetailTile({ icon: Icon, label, children, className }: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-bg-elevated/60 border border-bg-border/60 rounded-xl px-3.5 py-3', className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
        <Icon size={11} aria-hidden="true" /> {label}
      </p>
      <div className="text-sm font-bold text-text">{children}</div>
    </div>
  )
}

export default function NovelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [novel, setNovel] = useState<Novel | null>(null)
  // loading derives from "has the current id been fetched" so the effect
  // never calls setState synchronously (react-hooks/set-state-in-effect)
  const [fetchedId, setFetchedId] = useState<string | null>(null)
  const novelLoading = fetchedId !== id
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [chapterQuery, setChapterQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(true)

  // Live view count — reflects /api/views increments without a page refresh.
  const liveViews = useLiveViewCount('novels', id, novel?.viewCount ?? 0)

  // Real-time chapter listener — updates immediately when chapters are published
  const { chapters: allChapters, loading: chaptersLoading } = useChapters(id)
  const chapters = useMemo(() =>
    allChapters
      .filter((ch) => ch.status === 'published')
      .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)),
    [allChapters]
  )

  const visibleChapters = useMemo(() => {
    const q = chapterQuery.trim().toLowerCase()
    const filtered = q
      ? chapters.filter((ch) =>
          (ch.title ?? '').toLowerCase().includes(q) ||
          String(ch.chapterNumber ?? '').includes(q)
        )
      : chapters
    return sortAsc ? filtered : [...filtered].reverse()
  }, [chapters, chapterQuery, sortAsc])

  useEffect(() => {
    getNovelById(id)
      .then(setNovel)
      .catch(console.error)
      .finally(() => setFetchedId(id))
  }, [id])

  if (novelLoading) return (
    <div className="animate-pulse">
      <div className="h-[420px] bg-bg-elevated/50" />
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-4">
        <div className="h-5 w-64 bg-bg-elevated rounded" />
        <div className="h-4 w-full bg-bg-elevated rounded" />
        <div className="h-4 w-5/6 bg-bg-elevated rounded" />
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
  const showExpand = synopsis.length > 320
  const displaySynopsis = showExpand && !synopsisExpanded ? synopsis.slice(0, 320) + '…' : synopsis
  const firstChapter = chapters[0]
  const latestChapter = chapters[chapters.length - 1]
  const heroImage = novel.bannerURL || novel.coverURL
  const publishedYear = novel.publishedAt ? fromTimestamp(novel.publishedAt).getFullYear() : null
  const remaining = visibleChapters.length - 20

  return (
    <div>
      {/* Hero banner — cover art backdrop with title overlay */}
      <section className="relative" aria-label="Novel overview">
        {heroImage && (
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/10" />
          </div>
        )}

        <div className={cn(
          'relative max-w-screen-xl mx-auto px-4 flex items-end',
          heroImage ? 'min-h-[420px] sm:min-h-[520px] pt-40 sm:pt-64' : 'pt-10'
        )}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-7 pb-8 w-full">
            {/* Cover card */}
            <div className="w-32 sm:w-44 aspect-[2/3] rounded-xl bg-bg-elevated flex-shrink-0 overflow-hidden shadow-2xl ring-1 ring-white/10">
              {novel.coverURL
                ? <Image src={novel.coverURL} alt={`${novel.title} cover`} width={176} height={264} className="object-cover w-full h-full" />
                : <div className="w-full h-full flex items-center justify-center"><BookOpen size={32} className="text-text-muted" /></div>
              }
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0 space-y-3">
              <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border', badge.color)}>
                <Activity size={10} aria-hidden="true" />
                {badge.label}
                {publishedYear && <span className="opacity-70 font-normal">· {publishedYear}</span>}
              </span>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-text leading-tight tracking-tight">
                {novel.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span className="font-semibold text-text">Novel</span>
                {(novel.rating ?? 0) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <RatingStars rating={novel.rating ?? 0} />
                    {(novel.rating ?? 0).toFixed(1)}
                  </span>
                )}
                <span className="flex items-center gap-1" title="Views">
                  <Eye size={13} aria-hidden="true" /> {formatCount(liveViews)} views
                </span>
              </div>

              {novel.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {novel.genres.map((g) => (
                    <Link
                      key={g}
                      href={`/browse?genre=${g}`}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-bg-elevated/80 border border-bg-border text-text-secondary hover:text-text hover:border-accent/30 transition-colors capitalize focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              )}

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
                {latestChapter && latestChapter !== firstChapter && (
                  <Link
                    href={`/novel/${id}/chapter/${latestChapter.id}`}
                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-bg-elevated border border-bg-border text-text hover:border-accent/40 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <ChevronsRight size={14} aria-hidden="true" /> Latest
                  </Link>
                )}
                <LikeButton contentType="novel" contentId={id} initialCount={novel.likeCount ?? 0} authorId={novel.authorId} contentTitle={novel.title} />
                <BookmarkButton contentId={id} contentType="novel" />
                <RatingControl
                  contentType="novel"
                  contentId={id}
                  initialRating={novel.rating ?? 0}
                  initialCount={novel.ratingCount ?? 0}
                  onRated={(rating, ratingCount) =>
                    setNovel((prev) => prev ? { ...prev, rating, ratingCount } : prev)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
        {/* Details + Synopsis */}
        <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
          {/* Details card */}
          <section aria-labelledby="details-heading" className="bg-bg-card border border-bg-border rounded-2xl p-5">
            <h2 id="details-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">
              <span className="w-1 h-4 bg-accent rounded-full" aria-hidden="true" />
              Details
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <DetailTile icon={Star} label="Rating">
                {(novel.rating ?? 0) > 0 ? (
                  <>
                    {(novel.rating ?? 0).toFixed(1)}<span className="text-text-muted font-normal">/5</span>
                    <div className="mt-1"><RatingStars rating={novel.rating ?? 0} /></div>
                  </>
                ) : <span className="text-text-muted font-normal">Not rated</span>}
              </DetailTile>
              <DetailTile icon={BookOpen} label="Type">Novel</DetailTile>
              <DetailTile icon={Activity} label="Status"><span className="capitalize">{novel.status}</span></DetailTile>
              <DetailTile icon={Hash} label="Chapters">{chapters.length}</DetailTile>
              <DetailTile icon={Eye} label="Views">{formatCount(liveViews)}</DetailTile>
              <DetailTile icon={Calendar} label="Year">{publishedYear ?? '—'}</DetailTile>
            </div>

            {/* Author — identity, follower count and one-click subscribe */}
            <div className="mt-3 bg-bg-elevated/60 border border-bg-border/60 rounded-xl px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Author</p>
              <AuthorCard
                authorId={novel.authorId}
                authorName={novel.authorName}
                authorPhotoURL={novel.authorPhotoURL}
                size="sm"
              />
            </div>
          </section>

          {/* Synopsis */}
          <section aria-labelledby="synopsis-heading" className="space-y-5">
            <div>
              <h2 id="synopsis-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                <span className="w-1 h-4 bg-accent rounded-full" aria-hidden="true" />
                Synopsis
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {displaySynopsis || 'No synopsis yet.'}
              </p>
              {showExpand && (
                <button
                  type="button"
                  onClick={() => setSynopsisExpanded((v) => !v)}
                  className="text-xs font-semibold text-text hover:text-accent mt-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                >
                  {synopsisExpanded ? 'Read Less ↑' : 'Read More ↓'}
                </button>
              )}
            </div>

            {novel.genres?.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Genres</h3>
                <div className="flex flex-wrap gap-1.5">
                  {novel.genres.map((g) => (
                    <Link
                      key={g}
                      href={`/browse?genre=${g}`}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-bg-elevated border border-bg-border text-text-secondary hover:text-text hover:border-accent/30 transition-colors capitalize focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {novel.tags?.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Themes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {novel.tags.map((t) => (
                    <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-bg-elevated border border-bg-border text-text-secondary capitalize">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Chapter list */}
        <section aria-labelledby="chapters-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-bg-border">
            <h2 id="chapters-heading" className="text-base font-bold text-text flex items-center gap-2">
              <Clock size={15} aria-hidden="true" /> Chapters
              {chaptersLoading
                ? <Loader2 size={13} className="animate-spin text-text-muted" aria-hidden="true" />
                : <span className="text-sm font-normal text-text-muted">({chapters.length})</span>
              }
            </h2>
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <label htmlFor="chapter-search" className="sr-only">Search chapters</label>
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  id="chapter-search"
                  type="search"
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  placeholder="Search chapters…"
                  className="w-40 sm:w-52 bg-bg-elevated border border-bg-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
              </div>
              <Tooltip label={sortAsc ? 'Sort descending' : 'Sort ascending'}>
                <button
                  type="button"
                  onClick={() => setSortAsc((v) => !v)}
                  aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-bg-elevated border border-bg-border text-text-secondary hover:text-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ArrowUpDown size={12} aria-hidden="true" /> {sortAsc ? 'Asc' : 'Desc'}
                </button>
              </Tooltip>
            </div>
          </div>

          {!chaptersLoading && visibleChapters.length === 0 ? (
            <div className="text-center py-14 text-text-muted">
              <Clock size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                {chapterQuery ? 'No chapters match your search' : 'No chapters published yet'}
              </p>
              {!chapterQuery && <p className="text-xs mt-1 opacity-60">Check back soon</p>}
            </div>
          ) : (
            <>
              <div className="divide-y divide-bg-border/50">
                {(showAll ? visibleChapters : visibleChapters.slice(0, 20)).map((ch, i) => {
                  const readingMin = ch.wordCount > 0 ? Math.ceil(ch.wordCount / 200) : null
                  return (
                    <Link
                      key={ch.id}
                      href={`/novel/${id}/chapter/${ch.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-elevated/40 transition-colors group"
                      aria-label={`Read chapter ${ch.chapterNumber}: ${ch.title || 'Untitled'}`}
                    >
                      <span className="flex-shrink-0 font-mono text-xs font-bold text-text-secondary group-hover:text-accent transition-colors tabular-nums w-12">
                        Ch. {ch.chapterNumber ?? i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate leading-tight">
                          {ch.title || `Chapter ${ch.chapterNumber ?? i + 1}`}
                        </p>
                        {readingMin && (
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {ch.wordCount.toLocaleString()} words · {readingMin} min
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-text-muted">
                        {(ch.viewCount ?? 0) > 0 && (
                          <span className="hidden sm:flex items-center gap-1">
                            <Eye size={11} aria-hidden="true" /> {formatCount(ch.viewCount)}
                          </span>
                        )}
                        {ch.publishedAt && <span>{formatDate(ch.publishedAt)}</span>}
                        <ChevronRight size={14} className="text-text-muted/40 group-hover:text-accent transition-colors" aria-hidden="true" />
                      </div>
                    </Link>
                  )
                })}
              </div>

              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full py-3 text-sm text-text-muted hover:text-text border-t border-bg-border/50 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  {showAll ? 'Show fewer chapters' : `Show more (${remaining} remaining)`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
