'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Clapperboard, Film, Layers, Eye, Star, ArrowRight, Globe, Tv2, Sparkles } from 'lucide-react'
import CoverImage from '@/components/content/CoverImage'
import { fetchHomeFeed } from '@/lib/home/clientHomeFeed'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { Stat } from '@/components/ui/Stat'
import { HorizontalScroller } from '@/components/ui/HorizontalScroller'
import type { HomeFeedData, HomeItem } from '@/types/home'

/** Per-type presentation for a catalog card. One card, three content types. */
const TYPE_META = {
  novel: { label: 'Novel', icon: BookOpen, unit: 'Chapters', partIcon: Layers },
  webtoon: { label: 'Webtoon', icon: Tv2, unit: 'Episodes', partIcon: Layers },
  anime: { label: 'Anime', icon: Clapperboard, unit: 'Scenes', partIcon: Film },
} as const

function ContentCard({ item, eager }: { item: HomeItem; eager?: boolean }) {
  const meta = TYPE_META[item.type]
  const href = `/${item.type}/${item.id}`
  const unitLabel = meta.unit

  // The link's aria-label overrides its inner content for the accessible name,
  // so the stats have to be folded in here or they're never announced at all.
  const cardLabel = [
    `${item.title} — ${item.type}`,
    `${item.partCount} ${unitLabel.toLowerCase()}`,
    `${formatCount(item.viewCount)} views`,
    item.rating > 0 ? `rated ${item.rating.toFixed(1)} out of 5` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={href}
      data-tour="content-card"
      className="group block relative rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-white/20 transition-all duration-200"
      aria-label={cardLabel}
    >
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        <CoverImage
          src={item.coverURL}
          alt={item.title}
          sizes="(max-width: 640px) 44vw, (max-width: 768px) 176px, 192px"
          // The first row is above the fold on every viewport, so its covers are
          // the LCP candidates — fetched eagerly at high priority instead of
          // waiting for the lazy-load intersection check.
          eager={eager}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white capitalize border border-white/10">
            {item.status}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white border border-white/10">
            <meta.icon size={9} aria-hidden="true" />
            {meta.label}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1 min-h-[2.5em]">
          {toTitleCase(item.title)}
        </h3>
        {item.genres.length > 0 && (
          <p className="text-[11px] text-white/50 mb-1.5 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        {/* Wraps instead of clipping: on ≤360px phones the card is ~44vw wide and
            three stats at gap-3 overran the card's overflow-hidden edge, cutting
            the rating. gap-y lets the third stat drop to a second line if needed. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/60">
          <Stat icon={meta.partIcon} value={item.partCount} label={unitLabel} />
          <Stat icon={Eye} value={formatCount(item.viewCount)} label="Views" />
          {item.rating > 0 && (
            <Stat icon={Star} value={item.rating.toFixed(1)} label="Rating" />
          )}
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-bg-card border border-bg-border animate-pulse">
      <div className="aspect-[2/3] bg-bg-elevated" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-bg-elevated rounded w-4/5" />
        <div className="h-3 bg-bg-elevated rounded w-1/2" />
      </div>
    </div>
  )
}

function SectionHeader({ id, title, href, linkLabel }: { id: string; title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 id={id} className="section-heading">{title}</h2>
      <Link
        href={href}
        className="text-sm text-white/50 hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        aria-label={linkLabel}
      >
        View All <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  )
}

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'

/** A row of content cards that scrolls horizontally with left/right arrows.
 *  `eagerCount` marks the leading cards — the ones on screen without scrolling —
 *  as high-priority loads; the rest stay lazy. */
function CardRow({ items, label, eagerCount = 0 }: { items: HomeItem[]; label: string; eagerCount?: number }) {
  return (
    <HorizontalScroller ariaLabel={label}>
      {items.map((item, i) => (
        <div key={`${item.type}-${item.id}`} className="w-[44vw] sm:w-44 md:w-48 shrink-0 snap-start">
          <ContentCard item={item} eager={i < eagerCount} />
        </div>
      ))}
    </HorizontalScroller>
  )
}

const EMPTY_FEED: HomeFeedData = { trending: [], newReleases: [], novels: [], webtoons: [], anime: [] }

export function HomeFeed({ initialFeed }: { initialFeed?: HomeFeedData }) {
  const [feed, setFeed] = useState<HomeFeedData>(initialFeed ?? EMPTY_FEED)
  // Server data means there is nothing to wait for — render the cards (and
  // therefore the cover <img> tags) on the very first paint. The skeleton only
  // appears on the fallback path.
  const serverRendered = (initialFeed?.trending.length ?? 0) > 0
  const [loading, setLoading] = useState(!serverRendered)

  useEffect(() => {
    if (serverRendered) return
    // Fallback only: the server render came back empty (no Admin credentials,
    // or Firestore was unavailable). Firestore calls aren't abortable, so the
    // guard gates the setState rather than the request.
    let cancelled = false

    fetchHomeFeed()
      .then((data) => { if (!cancelled) setFeed(data) })
      .catch((e) => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [serverRendered])

  if (loading) {
    return (
      <div className="space-y-12 max-w-screen-xl mx-auto px-4 py-8">
        {[0, 1].map((s) => (
          <section key={s} aria-busy="true">
            <div className="h-6 bg-bg-elevated rounded w-40 mb-6 animate-pulse" />
            <div className={GRID}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </section>
        ))}
      </div>
    )
  }

  if (feed.trending.length === 0 && feed.newReleases.length === 0) {
    return (
      <section className="max-w-screen-xl mx-auto px-4 py-16 text-center" aria-labelledby="empty-heading">
        <Globe size={40} className="text-white/20 mx-auto mb-4" aria-hidden="true" />
        <h2 id="empty-heading" className="text-white/50 text-lg font-medium mb-2">No published content yet</h2>
        <p className="text-white/30 text-sm mb-6">Be the first creator to publish on Toonflow!</p>
        <Link href="/create" className="btn-accent">Start Creating</Link>
      </section>
    )
  }

  return (
    <div className="space-y-0">
      {/* Trending Now */}
      {feed.trending.length > 0 && (
        <section data-tour="home-feed" className="max-w-screen-xl mx-auto px-4 py-8" aria-labelledby="trending-heading">
          <SectionHeader
            id="trending-heading"
            title="Trending Now"
            href="/browse?sort=trending"
            linkLabel="View all trending content"
          />
          {/* Deliberately only 2. The hero owns the top of the fold and its
              background is the LCP element — every extra high-priority image
              competes with it for the same connection. Two covers is what
              actually peeks above the fold on a phone (cards are 44vw, so two
              per row); the rest sit within the browser's native lazy-load
              margin and get fetched on their own at normal priority. */}
          <CardRow items={feed.trending} label="Trending content" eagerCount={2} />
        </section>
      )}

      {/* New Releases */}
      {feed.newReleases.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="new-releases-heading">
          <SectionHeader
            id="new-releases-heading"
            title="New Releases"
            href="/browse?sort=newest"
            linkLabel="View all new releases"
          />
          <CardRow items={feed.newReleases} label="New releases" />
        </section>
      )}

      {/* Anime — AI-generated titles from the Anime Studio. Hidden entirely
          when nobody has published one, so the home page never shows an empty
          shelf. */}
      {feed.anime.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="anime-heading">
          <SectionHeader
            id="anime-heading"
            title="Anime"
            href="/browse?type=anime"
            linkLabel="View all anime"
          />
          <CardRow items={feed.anime} label="Anime" />
        </section>
      )}

      {/* Popular Novels */}
      {feed.novels.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="novels-heading">
          <SectionHeader
            id="novels-heading"
            title="Popular Novels"
            href="/browse?type=novel"
            linkLabel="View all novels"
          />
          <CardRow items={feed.novels} label="Popular novels" />
        </section>
      )}

      {/* Popular Webtoons */}
      {feed.webtoons.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="webtoons-heading">
          <SectionHeader
            id="webtoons-heading"
            title="Popular Webtoons"
            href="/browse?type=webtoon"
            linkLabel="View all webtoons"
          />
          <CardRow items={feed.webtoons} label="Popular webtoons" />
        </section>
      )}

      {/* Originals promo */}
      <section
        className="max-w-screen-xl mx-auto px-4 pb-16"
        aria-labelledby="originals-promo-heading"
      >
        <div className="bg-bg-elevated border border-bg-border p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-accent" aria-hidden="true" />
              <Tv2 size={18} className="text-accent" aria-hidden="true" />
              <h2 id="originals-promo-heading" className="text-lg font-bold text-white">Toonflow Originals</h2>
            </div>
            <p className="text-white/60 max-w-sm">
              Exclusive webtoons and novels created by top creators — only on Toonflow.
            </p>
          </div>
          <Link href="/originals" className="btn-accent shrink-0">
            Explore Originals
          </Link>
        </div>
      </section>
    </div>
  )
}
