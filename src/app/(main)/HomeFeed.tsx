'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Layers, Eye, Star, ArrowRight, Globe, Tv2, Sparkles } from 'lucide-react'
import { getTrendingNovels, getTrendingWebtoons, getNewReleases } from '@/lib/firebase/firestore'
import { cachedRequest } from '@/lib/utils/requestCache'
import { formatCount } from '@/lib/utils/formatters'
import type { Novel, Webtoon } from '@/types'

function ContentCard({ item, type }: { item: Novel | Webtoon; type: 'novel' | 'webtoon' }) {
  const chapterCount = 'chapterCount' in item ? item.chapterCount : (item as Webtoon).episodeCount
  const href = `/${type}/${item.id}`

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-white/20 transition-all duration-200"
      aria-label={`${item.title} — ${type}`}
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
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">
          {item.title}
        </h3>
        {item.genres?.length > 0 && (
          <p className="text-[11px] text-white/50 mb-1.5 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Layers size={10} aria-hidden="true" />
            {chapterCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={10} aria-hidden="true" />
            {formatCount(item.viewCount)}
          </span>
          {item.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star size={10} aria-hidden="true" />
              {item.rating.toFixed(1)}
            </span>
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
    // Shared 60s cache: HeroSlider reuses the same two trending requests,
    // and back-navigation to the home page renders instantly from cache.
    Promise.all([
      cachedRequest('trending-novels-12', 60_000, () => getTrendingNovels(12)),
      cachedRequest('trending-webtoons-12', 60_000, () => getTrendingWebtoons(12)),
      cachedRequest('new-releases-6', 60_000, () => getNewReleases(6)),
    ])
      .then(([n, w, releases]) => {
        setNovels(n)
        setWebtoons(w)
        setNewNovels(releases.novels)
        setNewWebtoons(releases.webtoons)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allTrending = [
    ...novels.map((n) => ({ item: n, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
  ].sort((a, b) => b.item.viewCount - a.item.viewCount).slice(0, 12)

  const newReleases = [
    ...newNovels.map((n) => ({ item: n, type: 'novel' as const })),
    ...newWebtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
  ].slice(0, 6)

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
