'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Layers, Eye, Star, ArrowRight, Globe, Tv2, Sparkles } from 'lucide-react'
import { getTrendingNovels, getTrendingWebtoons, getNewReleases } from '@/lib/firebase/firestore'
import { cachedRequest } from '@/lib/utils/requestCache'
import { formatCount } from '@/lib/utils/formatters'
import { Stat } from '@/components/ui/Stat'
import type { Novel, Webtoon } from '@/types'

function ContentCard({ item, type }: { item: Novel | Webtoon; type: 'novel' | 'webtoon' }) {
  const chapterCount = 'chapterCount' in item ? item.chapterCount : (item as Webtoon).episodeCount
  const href = `/${type}/${item.id}`
  const unitLabel = type === 'novel' ? 'Chapters' : 'Episodes'

  // The link's aria-label overrides its inner content for the accessible name,
  // so the stats have to be folded in here or they're never announced at all.
  const cardLabel = [
    `${item.title} — ${type}`,
    `${chapterCount} ${unitLabel.toLowerCase()}`,
    `${formatCount(item.viewCount)} views`,
    item.rating > 0 ? `rated ${item.rating.toFixed(1)} out of 5` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-white/20 transition-all duration-200"
      aria-label={cardLabel}
    >
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {item.coverURL ? (
          <Image
            src={item.coverURL}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen size={28} className="text-white/20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white capitalize border border-white/10">
            {item.status}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white border border-white/10">
            {type === 'novel'
              ? <BookOpen size={9} aria-hidden="true" />
              : <Tv2 size={9} aria-hidden="true" />}
            {type === 'novel' ? 'Novel' : 'Webtoon'}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">
          {item.title}
        </h3>
        {item.genres?.length > 0 && (
          <p className="text-[11px] text-white/50 mb-1.5 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-white/60">
          <Stat icon={Layers} value={chapterCount} label={unitLabel} />
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

export function HomeFeed() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [newNovels, setNewNovels] = useState<Novel[]>([])
  const [newWebtoons, setNewWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Firestore calls aren't abortable, so the guard gates the setState rather
    // than the request — same idiom as hooks/useFirestore.ts.
    let cancelled = false

    // Shared 60s cache: HeroSlider reuses the same two trending requests,
    // and back-navigation to the home page renders instantly from cache.
    Promise.all([
      cachedRequest('trending-novels-12', 60_000, () => getTrendingNovels(12)),
      cachedRequest('trending-webtoons-12', 60_000, () => getTrendingWebtoons(12)),
      cachedRequest('new-releases-6', 60_000, () => getNewReleases(6)),
    ])
      .then(([n, w, releases]) => {
        if (cancelled) return
        setNovels(n)
        setWebtoons(w)
        setNewNovels(releases.novels)
        setNewWebtoons(releases.webtoons)
      })
      .catch((e) => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  // Memoized: these spread + sort + slice both arrays on every render, and this
  // component re-renders on each of the four setState calls above.
  const allTrending = useMemo(() => [
    ...novels.map((n) => ({ item: n, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
  ].sort((a, b) => b.item.viewCount - a.item.viewCount).slice(0, 12), [novels, webtoons])

  const newReleases = useMemo(() => [
    ...newNovels.map((n) => ({ item: n, type: 'novel' as const })),
    ...newWebtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
  ].slice(0, 6), [newNovels, newWebtoons])

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

  if (allTrending.length === 0 && newReleases.length === 0) {
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
      {allTrending.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 py-8" aria-labelledby="trending-heading">
          <SectionHeader
            id="trending-heading"
            title="Trending Now"
            href="/browse?sort=trending"
            linkLabel="View all trending content"
          />
          <div className={GRID}>
            {allTrending.map(({ item, type }) => (
              <ContentCard key={`${type}-${item.id}`} item={item} type={type} />
            ))}
          </div>
        </section>
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="new-releases-heading">
          <SectionHeader
            id="new-releases-heading"
            title="New Releases"
            href="/browse?sort=newest"
            linkLabel="View all new releases"
          />
          <div className={GRID}>
            {newReleases.map(({ item, type }) => (
              <ContentCard key={`${type}-${item.id}`} item={item} type={type} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Novels */}
      {novels.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="novels-heading">
          <SectionHeader
            id="novels-heading"
            title="Popular Novels"
            href="/browse?type=novel"
            linkLabel="View all novels"
          />
          <div className={GRID}>
            {novels.slice(0, 6).map((n) => <ContentCard key={n.id} item={n} type="novel" />)}
          </div>
        </section>
      )}

      {/* Popular Webtoons */}
      {webtoons.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="webtoons-heading">
          <SectionHeader
            id="webtoons-heading"
            title="Popular Webtoons"
            href="/browse?type=webtoon"
            linkLabel="View all webtoons"
          />
          <div className={GRID}>
            {webtoons.slice(0, 6).map((w) => <ContentCard key={w.id} item={w} type="webtoon" />)}
          </div>
        </section>
      )}

      {/* Originals promo */}
      <section
        className="max-w-screen-xl mx-auto px-4 pb-16"
        aria-labelledby="originals-promo-heading"
      >
        <div className="bg-bg-elevated border border-bg-border p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
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
