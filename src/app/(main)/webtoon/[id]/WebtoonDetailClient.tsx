'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ImageIcon, Eye, Heart, Star, ChevronRight,
  Clock, Play,
} from 'lucide-react'
import { getWebtoonById } from '@/lib/firebase/firestore'
import { useLiveCounts } from '@/hooks/useLiveCounts'
import { useEpisodes } from '@/hooks/useEpisodes'
import { formatCount, formatDate, toTitleCase } from '@/lib/utils/formatters'
import { Stat } from '@/components/ui/Stat'
import LikeButton from '@/components/reader/LikeButton'
import BookmarkButton from '@/components/reader/BookmarkButton'
import ShareButton from '@/components/ui/ShareButton'
import DownloadEpisodeMenu from '@/components/reader/DownloadEpisodeMenu'
import AuthorCard from '@/components/social/AuthorCard'
import { cn } from '@/lib/utils/cn'
import type { Webtoon } from '@/types'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ongoing:   { label: 'Ongoing',   color: 'bg-accent/10 text-accent border-accent/20' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  hiatus:    { label: 'Hiatus',    color: 'bg-warning/10 text-warning border-warning/20' },
  draft:     { label: 'Draft',     color: 'bg-bg-elevated text-text-muted border-bg-border' },
  published: { label: 'Published', color: 'bg-accent/10 text-accent border-accent/20' },
}

export default function WebtoonDetailClient() {
  const { id } = useParams<{ id: string }>()
  const [webtoon, setWebtoon] = useState<Webtoon | null>(null)
  const [loading, setLoading] = useState(true)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)

  // Real-time episode listener (as the novel page already does for chapters).
  // A one-shot fetch left every per-episode view count frozen at whatever it was
  // when the page loaded: reading an episode and pressing Back restores this
  // page from the router cache without refetching, so the number a reader had
  // just incremented still showed the old value.
  const { episodes: allEpisodes } = useEpisodes(id)
  const episodes = useMemo(
    () => allEpisodes
      .filter((e) => e.status === 'published')
      .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)),
    [allEpisodes]
  )

  // Live counters — reflect /api/views increments and other readers' likes
  // without a page refresh.
  const { viewCount: liveViews, likeCount: liveLikes } = useLiveCounts('webtoons', id, {
    viewCount: webtoon?.viewCount ?? 0,
    likeCount: webtoon?.likeCount ?? 0,
  })

  useEffect(() => {
    getWebtoonById(id)
      .then(setWebtoon)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

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

  // NOTE: the schema.org ComicSeries + BreadcrumbList entities for this page are
  // emitted server-side in page.tsx, so they land in the raw HTML for crawlers
  // that don't execute JS. Do not re-add a client-rendered <JsonLd> here — it
  // would duplicate the entity.

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
            <h1 className="text-2xl font-bold text-text leading-tight break-words">{toTitleCase(webtoon.title)}</h1>
            <div className="mt-3 max-w-sm">
              <AuthorCard
                authorId={webtoon.authorId}
                authorName={webtoon.authorName}
                authorPhotoURL={webtoon.authorPhotoURL}
                size="sm"
              />
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

          {/* `title` names each icon on hover. The visible text already carries
              the unit ("1.2K views"), so no extra screen-reader text is needed. */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            {/* Total across every episode — /api/views bumps the episode and this
                webtoon in one transaction, so the two always agree. */}
            <span className="flex items-center gap-1" title={`${liveViews.toLocaleString()} total views`}><Eye size={13} aria-hidden="true" /> {formatCount(liveViews)} views</span>
            <span className="flex items-center gap-1" title="Likes"><Heart size={13} aria-hidden="true" /> {formatCount(liveLikes)} likes</span>
            <span className="flex items-center gap-1" title="Episodes"><ImageIcon size={13} aria-hidden="true" /> {webtoon.episodeCount ?? episodes.length} episodes</span>
            {(webtoon.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1" title="Average rating">
                <Star size={13} className="text-warning" aria-hidden="true" /> {(webtoon.rating ?? 0).toFixed(1)}
                <span className="sr-only"> out of 5</span>
              </span>
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
            <LikeButton contentType="webtoon" contentId={id} initialCount={liveLikes} authorId={webtoon.authorId} contentTitle={webtoon.title} />
            <BookmarkButton contentId={id} contentType="webtoon" showLabel />
            <ShareButton title={toTitleCase(webtoon.title)} text={synopsis || undefined} showLabel />
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
              // Row is a flex container, not a single Link, so the download menu
              // can sit alongside the navigation link without nesting a button
              // inside an anchor. Download lives here — never in the reader — so
              // reading stays a clean, chrome-light experience.
              <div
                key={ep.id}
                className="flex items-center border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/40 transition-colors group"
              >
                <Link
                  href={`/webtoon/${id}/episode/${ep.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-l-2xl"
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
                    {/* Always rendered, including at zero: an absent badge reads as
                        "views aren't tracked here", which is exactly the wrong
                        message on a brand-new episode. */}
                    <Stat icon={Eye} size={11} value={formatCount(ep.viewCount ?? 0)} label="Views" />
                    {ep.publishedAt && <span className="hidden sm:inline">{formatDate(ep.publishedAt)}</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-1 pl-1 pr-4 flex-shrink-0">
                  <DownloadEpisodeMenu webtoonTitle={webtoon.title} episode={ep} />
                  <ChevronRight size={14} className="text-text-muted group-hover:text-accent transition-colors" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
