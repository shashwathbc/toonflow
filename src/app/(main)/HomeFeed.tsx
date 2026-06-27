'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Layers, Eye, Star, ArrowRight, Loader2, Globe } from 'lucide-react'
import { getTrendingNovels, getTrendingWebtoons } from '@/lib/firebase/firestore'
import { formatCount, formatRelativeTimestamp } from '@/lib/utils/formatters'
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

export function HomeFeed() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTrendingNovels(12), getTrendingWebtoons(12)])
      .then(([n, w]) => { setNovels(n); setWebtoons(w) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allTrending = [
    ...novels.map((n) => ({ item: n, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
  ].sort((a, b) => b.item.viewCount - a.item.viewCount).slice(0, 12)

  if (loading) {
    return (
      <section className="max-w-screen-xl mx-auto px-4 py-8" aria-labelledby="trending-heading">
        <h2 id="trending-heading" className="section-heading mb-6">Trending Now</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    )
  }

  if (allTrending.length === 0) {
    return (
      <section className="max-w-screen-xl mx-auto px-4 py-8" aria-labelledby="trending-heading">
        <h2 id="trending-heading" className="section-heading mb-6">Trending Now</h2>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Globe size={32} className="text-white/20 mb-4" aria-hidden="true" />
          <p className="text-white/50 text-sm">No published content yet. Be the first creator!</p>
          <Link href="/create" className="btn-accent mt-4 text-sm">Start Creating</Link>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Trending Now */}
      <section className="max-w-screen-xl mx-auto px-4 py-8" aria-labelledby="trending-heading">
        <div className="flex items-center justify-between mb-6">
          <h2 id="trending-heading" className="section-heading">Trending Now</h2>
          <Link
            href="/browse"
            className="text-sm text-white/50 hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label="View all content in browse page"
          >
            View All <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {allTrending.map(({ item, type }) => (
            <ContentCard key={`${type}-${item.id}`} item={item} type={type} />
          ))}
        </div>
      </section>

      {/* Novels section */}
      {novels.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="novels-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="novels-heading" className="section-heading">Popular Novels</h2>
            <Link href="/browse?type=novel" className="text-sm text-white/50 hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
              More Novels <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {novels.slice(0, 6).map((n) => <ContentCard key={n.id} item={n} type="novel" />)}
          </div>
        </section>
      )}

      {/* Webtoons section */}
      {webtoons.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-8" aria-labelledby="webtoons-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="webtoons-heading" className="section-heading">Popular Webtoons</h2>
            <Link href="/browse?type=webtoon" className="text-sm text-white/50 hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
              More Webtoons <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {webtoons.slice(0, 6).map((w) => <ContentCard key={w.id} item={w} type="webtoon" />)}
          </div>
        </section>
      )}
    </>
  )
}
