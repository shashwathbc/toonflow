'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Eye, Heart, Layers, Star, Tv2, TrendingUp, Clock, StarIcon } from 'lucide-react'
import { browseContent } from '@/lib/firebase/firestore'
import { formatCount } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { Novel, Webtoon } from '@/types'

type SortBy = 'trending' | 'newest' | 'rating'

const SORT_OPTIONS: { label: string; value: SortBy; icon: React.ReactNode }[] = [
  { label: 'Trending', value: 'trending', icon: <TrendingUp size={13} aria-hidden="true" /> },
  { label: 'Newest', value: 'newest', icon: <Clock size={13} aria-hidden="true" /> },
  { label: 'Top Rated', value: 'rating', icon: <StarIcon size={13} aria-hidden="true" /> },
]

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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
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
  const [items, setItems] = useState<{ item: Novel | Webtoon; type: 'novel' | 'webtoon' }[]>([])
  const [sortBy, setSortBy] = useState<SortBy>('trending')
  // loading derives from "has the current sort been loaded" so the effect
  // never calls setState synchronously (react-hooks/set-state-in-effect)
  const [loadedSort, setLoadedSort] = useState<SortBy | null>(null)
  const loading = loadedSort !== sortBy

  useEffect(() => {
    browseContent({ sortBy, limitCount: 48 })
      .then(({ novels, webtoons }) => {
        const combined = [
          ...novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })),
          ...webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })),
        ]
        if (sortBy === 'trending') {
          combined.sort((a, b) => b.item.viewCount - a.item.viewCount)
        } else if (sortBy === 'rating') {
          combined.sort((a, b) => b.item.rating - a.item.rating)
        }
        setItems(combined)
      })
      .catch(console.error)
      .finally(() => setLoadedSort(sortBy))
  }, [sortBy])

  return (
    <div>
      {/* Sort tabs */}
      <div className="flex items-center gap-2 mb-6" role="tablist" aria-label="Sort originals by">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={sortBy === opt.value ? 'true' : 'false'}
            onClick={() => setSortBy(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              sortBy === opt.value
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'bg-bg-elevated border border-bg-border text-white/60 hover:text-white hover:border-white/20'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-5">
            <Tv2 size={32} className="text-white/20" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Published Content Yet</h2>
          <p className="text-white/50 text-sm max-w-xs mb-6">
            Be the first creator to publish on Toonflow!
          </p>
          <Link href="/create" className="btn-accent">Start Creating</Link>
        </div>
      ) : (
        <section aria-labelledby="originals-grid-heading">
          <h2 id="originals-grid-heading" className="sr-only">Originals content grid</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map(({ item, type }) => (
              <OriginalCard key={`${type}-${item.id}`} item={item} type={type} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
