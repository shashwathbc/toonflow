'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CoverImage from '@/components/content/CoverImage'
import { BookOpen, Clapperboard, Eye, Film, Heart, Layers, Star, Tv2, TrendingUp, Clock, StarIcon } from 'lucide-react'
import { browseContent } from '@/lib/firebase/firestore'
import { listPublishedAnime } from '@/lib/firebase/anime'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { Stat } from '@/components/ui/Stat'
import { cn } from '@/lib/utils/cn'
import type { Novel, Webtoon } from '@/types'
import type { AnimeProject } from '@/types/anime'

type SortBy = 'trending' | 'newest' | 'rating'

/** A catalog row, whatever its underlying content type. */
type OriginalEntry =
  | { type: 'novel'; item: Novel }
  | { type: 'webtoon'; item: Webtoon }
  | { type: 'anime'; item: AnimeProject }

const TYPE_LABEL: Record<OriginalEntry['type'], string> = {
  novel: 'novel',
  webtoon: 'webtoon',
  anime: 'anime',
}

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

function OriginalCard({ entry }: { entry: OriginalEntry }) {
  const { type, item } = entry
  const isAnime = type === 'anime'
  const chapterCount = isAnime
    ? (entry.item as AnimeProject).sceneCount
    : 'chapterCount' in item
      ? (item as Novel).chapterCount
      : (item as Webtoon).episodeCount
  const unitLabel = type === 'novel' ? 'Chapters' : type === 'webtoon' ? 'Episodes' : 'Scenes'
  const coverURL = isAnime ? (entry.item as AnimeProject).thumbnailURL : (item as Novel).coverURL
  // Anime carries no star rating yet; 0.0 would read as "rated badly" rather
  // than "not rated", so the stat is omitted for it.
  const rating = isAnime ? 0 : (item as Novel).rating
  // Anime stores its creator as `ownerName`; novels and webtoons as
  // `authorName`. Normalised once so the card body stays type-agnostic.
  const creatorName = isAnime ? (entry.item as AnimeProject).ownerName : (item as Novel).authorName

  // Folded into the link label because aria-label overrides inner content.
  const cardLabel = [
    `${item.title} — Toonflow Original ${TYPE_LABEL[type]}`,
    `${chapterCount} ${unitLabel.toLowerCase()}`,
    `${formatCount(item.viewCount)} views`,
    `${formatCount(item.likeCount)} likes`,
    rating > 0 ? `rated ${rating.toFixed(1)} out of 5` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={isAnime ? `/anime/${item.id}` : `/${type}/${item.id}`}
      className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-accent/30 transition-all duration-200"
      aria-label={cardLabel}
    >
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        <CoverImage
          src={coverURL}
          alt={item.title}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
            Original
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white border border-white/10">
            {type === 'novel'
              ? <BookOpen size={9} aria-hidden="true" />
              : <Tv2 size={9} aria-hidden="true" />}
            {isAnime && <Clapperboard size={9} aria-hidden="true" />}
            {type === 'novel' ? 'Novel' : type === 'webtoon' ? 'Webtoon' : 'Anime'}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">{toTitleCase(item.title)}</h3>
        <p className="text-xs text-white/50 mb-2">{creatorName}</p>
        {item.genres?.length > 0 && (
          <p className="text-[11px] text-white/40 mb-2 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-2.5 text-[11px] text-white/60">
          <Stat icon={isAnime ? Film : Layers} value={chapterCount} label={unitLabel} />
          <Stat icon={Eye} value={formatCount(item.viewCount)} label="Views" />
          <Stat icon={Heart} value={formatCount(item.likeCount)} label="Likes" />
          {rating > 0 && <Stat icon={Star} value={rating.toFixed(1)} label="Rating" />}
        </div>
      </div>
    </Link>
  )
}

export function OriginalsClient() {
  const [items, setItems] = useState<OriginalEntry[]>([])
  const [sortBy, setSortBy] = useState<SortBy>('trending')
  // loading derives from "has the current sort been loaded" so the effect
  // never calls setState synchronously (react-hooks/set-state-in-effect)
  const [loadedSort, setLoadedSort] = useState<SortBy | null>(null)
  const loading = loadedSort !== sortBy

  useEffect(() => {
    Promise.all([
      browseContent({ sortBy, limitCount: 48 }),
      listPublishedAnime({ sortBy, limitCount: 48 }),
    ])
      .then(([{ novels, webtoons }, anime]) => {
        const combined: OriginalEntry[] = [
          ...novels.map((n): OriginalEntry => ({ type: 'novel', item: n })),
          ...webtoons.map((w): OriginalEntry => ({ type: 'webtoon', item: w })),
          ...anime.map((a): OriginalEntry => ({ type: 'anime', item: a })),
        ]
        if (sortBy === 'trending') {
          combined.sort((a, b) => b.item.viewCount - a.item.viewCount)
        } else if (sortBy === 'rating') {
          // Anime has no star rating, so it ranks by likes within the same
          // ordering rather than sinking to the bottom on a permanent 0.
          const score = (entry: OriginalEntry) =>
            entry.type === 'anime' ? entry.item.likeCount : entry.item.rating
          combined.sort((a, b) => score(b) - score(a))
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
            {...(sortBy === opt.value ? { 'aria-selected': 'true' } : { 'aria-selected': 'false' })}
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
            {items.map((entry) => (
              <OriginalCard key={`${entry.type}-${entry.item.id}`} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
