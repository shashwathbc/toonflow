'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Eye, Heart, Layers, Star, Tv2 } from 'lucide-react'
import { getOriginals } from '@/lib/firebase/firestore'
import { formatCount } from '@/lib/utils/formatters'
import type { Novel, Webtoon } from '@/types'

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

function OriginalCard({ item, type }: { item: Novel | Webtoon; type: 'novel' | 'webtoon' }) {
  const chapterCount = 'chapterCount' in item ? item.chapterCount : (item as Webtoon).episodeCount
  return (
    <Link
      href={`/${type}/${item.id}`}
      className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-accent/30 transition-all duration-200"
      aria-label={`${item.title} — Toonflow Original`}
    >
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {item.coverURL ? (
          <Image
            src={item.coverURL}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen size={28} className="text-white/20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-white font-semibold">
            Original
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">{item.title}</h3>
        <p className="text-xs text-white/50 mb-2">{item.authorName}</p>
        {item.genres?.length > 0 && (
          <p className="text-[11px] text-white/40 mb-2 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-2.5 text-[11px] text-white/40">
          <span className="flex items-center gap-1"><Layers size={10} aria-hidden="true" />{chapterCount}</span>
          <span className="flex items-center gap-1"><Eye size={10} aria-hidden="true" />{formatCount(item.viewCount)}</span>
          <span className="flex items-center gap-1"><Heart size={10} aria-hidden="true" />{formatCount(item.likeCount)}</span>
          {item.rating > 0 && <span className="flex items-center gap-1"><Star size={10} aria-hidden="true" />{item.rating.toFixed(1)}</span>}
        </div>
      </div>
    </Link>
  )
}

export function OriginalsClient() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOriginals(24)
      .then(({ novels: n, webtoons: w }) => { setNovels(n); setWebtoons(w) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (novels.length === 0 && webtoons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-5">
          <Tv2 size={32} className="text-white/20" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Originals Yet</h2>
        <p className="text-white/50 text-sm max-w-xs">
          Exclusive content from top creators is coming soon. Check back later!
        </p>
      </div>
    )
  }

  const allItems = [
    ...novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })),
  ].sort((a, b) => b.item.viewCount - a.item.viewCount)

  return (
    <section aria-labelledby="originals-grid-heading">
      <h2 id="originals-grid-heading" className="sr-only">Originals content grid</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {allItems.map(({ item, type }) => (
          <OriginalCard key={`${type}-${item.id}`} item={item} type={type} />
        ))}
      </div>
    </section>
  )
}
