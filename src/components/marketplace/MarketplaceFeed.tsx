'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Eye,
  Heart,
  LayoutGrid,
  Loader2,
  Palette,
  Rows3,
  Search,
  Shirt,
  Store,
} from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { listPublishedArtworks, listPublishedProducts, type MarketSort } from '@/lib/firebase/art'
import { formatMinor, PRODUCT_CATALOG, productDefinition } from '@/lib/art/catalog'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import { ART_CATEGORIES, type ArtCategory, type Artwork, type Product, type ProductType } from '@/types/art'

export type MarketTab = 'all' | 'art' | 'merch'

/**
 * One entry in the feed. Artwork and products are interleaved into a single
 * chronological/ranked stream rather than shown as two separate grids — that is
 * what makes it read as a feed you scroll rather than a catalog you browse.
 */
type FeedEntry =
  | { kind: 'artwork'; id: string; item: Artwork }
  | { kind: 'product'; id: string; item: Product }

const EMPTY: FeedEntry[] = []

/** How many entries to reveal per page as the sentinel scrolls into view. */
const PAGE_SIZE = 6

const SORTS: { id: MarketSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'trending', label: 'Trending' },
  { id: 'price-low', label: 'Price: low to high' },
  { id: 'price-high', label: 'Price: high to low' },
]

function recencyOf(entry: FeedEntry): number {
  const ts = entry.item.publishedAt ?? entry.item.createdAt
  return ts?.seconds ?? 0
}

/**
 * A single full-width post.
 *
 * Deliberately image-first and near-square: the artwork is the product here, so
 * it gets the whole column width, with the creator above it and the actions
 * below — the layout people already know from social feeds.
 */
function FeedPost({ entry, priority }: { entry: FeedEntry; priority: boolean }) {
  const isArtwork = entry.kind === 'artwork'
  const item = entry.item
  const href = isArtwork ? `/artwork/${item.id}` : `/product/${item.id}`
  const image = isArtwork ? (entry.item as Artwork).imageURL : (entry.item as Product).previewURL
  const creatorName = item.ownerName
  const creatorPhoto = item.ownerPhotoURL

  const subtitle = isArtwork
    ? (entry.item as Artwork).category.replace('-', ' ')
    : (productDefinition((entry.item as Product).productType)?.label ?? 'Product')

  return (
    <article className="border-b border-bg-border pb-6 last:border-b-0">
      {/* Creator header */}
      <header className="flex items-center gap-2.5 pb-3">
        <Link
          href={`/profile/${item.ownerId}`}
          className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {creatorPhoto ? (
            <Image
              src={creatorPhoto}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-[11px] font-bold text-text-secondary"
            >
              {creatorName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-text">{creatorName}</span>
            <span className="block truncate text-[11px] capitalize text-text-muted">{subtitle}</span>
          </span>
        </Link>

        {!isArtwork && (
          <span className="ml-auto shrink-0 rounded-full bg-studio-art/12 px-2.5 py-1 text-xs font-bold tabular-nums text-studio-art">
            {formatMinor((entry.item as Product).fromPriceMinor)}
          </span>
        )}
      </header>

      {/* Media */}
      <Link
        href={href}
        onClick={() => {
          if (!isArtwork) {
            track('product_viewed', {
              productId: item.id,
              productType: (entry.item as Product).productType,
              surface: 'feed',
            })
          }
        }}
        className="block overflow-hidden rounded-2xl bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
        aria-label={`${item.title} by ${creatorName}`}
      >
        <div className="relative aspect-square w-full">
          {image ? (
            <Image
              src={image}
              alt={item.title}
              fill
              // The feed is a single column capped at ~560px, so above ~640px
              // the image never needs more than that width.
              sizes="(max-width: 640px) 100vw, 560px"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-text-muted">
              {isArtwork ? (
                <Palette size={26} aria-hidden="true" />
              ) : (
                <Shirt size={26} aria-hidden="true" />
              )}
            </span>
          )}
        </div>
      </Link>

      {/* Caption + stats */}
      <div className="pt-3">
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Heart size={14} aria-hidden="true" />
            <span className="sr-only">Likes:</span>
            {formatCount(item.likeCount)}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={14} aria-hidden="true" />
            <span className="sr-only">Views:</span>
            {formatCount(item.viewCount)}
          </span>
        </div>

        <h2 className="mt-2 text-sm font-bold text-text">
          <Link
            href={href}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {toTitleCase(item.title)}
          </Link>
        </h2>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" role="list">
            {item.tags.slice(0, 6).map((tag) => (
              <li key={tag} className="text-[11px] text-text-muted">
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

/** Compact grid tile, for the alternate density. */
function GridTile({ entry }: { entry: FeedEntry }) {
  const isArtwork = entry.kind === 'artwork'
  const item = entry.item
  const href = isArtwork ? `/artwork/${item.id}` : `/product/${item.id}`
  const image = isArtwork ? (entry.item as Artwork).imageURL : (entry.item as Product).previewURL

  return (
    <Link
      href={href}
      className="group relative block aspect-square overflow-hidden rounded-lg bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art"
      aria-label={`${item.title} by ${item.ownerName}`}
    >
      {image ? (
        <Image
          src={image}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 220px"
          className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-text-muted">
          {isArtwork ? <Palette size={20} aria-hidden="true" /> : <Shirt size={20} aria-hidden="true" />}
        </span>
      )}
      {/* Hover overlay carries the stats a feed post shows inline. */}
      <span className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="flex items-center gap-3 text-[11px] font-medium text-white">
          <span className="flex items-center gap-1">
            <Heart size={11} aria-hidden="true" />
            {formatCount(item.likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={11} aria-hidden="true" />
            {formatCount(item.viewCount)}
          </span>
        </span>
      </span>
    </Link>
  )
}

export default function MarketplaceFeed({ initialTab = 'all' }: { initialTab?: MarketTab }) {
  const [tab, setTab] = useState<MarketTab>(initialTab)
  const [sort, setSort] = useState<MarketSort>('newest')
  const [category, setCategory] = useState<ArtCategory | 'all'>('all')
  const [productType, setProductType] = useState<ProductType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [density, setDensity] = useState<'feed' | 'grid'>('feed')
  /**
   * How many posts are rendered, TAGGED with the filter+search combination they
   * belong to. Deriving the reveal window this way resets it whenever the result
   * set changes underneath, without an effect that sets state synchronously —
   * otherwise a narrower filter would render an already-scrolled-past page.
   */
  const [reveal, setReveal] = useState<{ key: string; count: number }>({ key: '', count: PAGE_SIZE })

  // One result object per filter combination, so `loading` is derived and a
  // stale response for a filter the user has moved off can never paint.
  const queryKey = `${tab}|${sort}|${category}|${productType}`
  const [result, setResult] = useState<{ key: string; entries: FeedEntry[]; error: string | null } | null>(
    null,
  )
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      tab === 'merch'
        ? Promise.resolve([] as Artwork[])
        : listPublishedArtworks({ category: category === 'all' ? undefined : category, sort }),
      tab === 'art'
        ? Promise.resolve([] as Product[])
        : listPublishedProducts({ productType: productType === 'all' ? undefined : productType, sort }),
    ])
      .then(([art, prod]) => {
        if (!active) return
        const entries: FeedEntry[] = [
          ...art.map((item): FeedEntry => ({ kind: 'artwork', id: `artwork-${item.id}`, item })),
          ...prod.map((item): FeedEntry => ({ kind: 'product', id: `product-${item.id}`, item })),
        ]

        // Interleave the two collections into ONE stream. Each was already
        // sorted server-side, but they arrive as separate lists — merging on the
        // active sort is what stops the feed from showing every product before
        // every artwork.
        entries.sort((a, b) => {
          if (sort === 'trending') return b.item.likeCount - a.item.likeCount
          if (sort === 'price-low' || sort === 'price-high') {
            // Artwork has no price; keep it after priced items rather than
            // treating it as free and pinning it to the top of a price sort.
            const priceOf = (entry: FeedEntry) =>
              entry.kind === 'product' ? entry.item.fromPriceMinor : Number.POSITIVE_INFINITY
            const diff = priceOf(a) - priceOf(b)
            return sort === 'price-low' ? diff : -diff
          }
          return recencyOf(b) - recencyOf(a)
        })

        setResult({ key: queryKey, entries, error: null })
      })
      .catch((err) => {
        console.error('[MarketplaceFeed]', err)
        if (!active) return
        setResult({
          key: queryKey,
          entries: [],
          error: 'Could not load the marketplace right now. Please try again shortly.',
        })
      })
    return () => {
      active = false
    }
  }, [queryKey, tab, sort, category, productType, reloadNonce])

  const fresh = result?.key === queryKey ? result : null
  const loading = fresh === null
  const error = fresh?.error ?? null
  const entries = fresh?.entries ?? EMPTY

  // Client-side text filtering, matching /browse: result sets are small and
  // Firestore has no substring search.
  const needle = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return entries
    return entries.filter(
      (entry) =>
        entry.item.title.toLowerCase().includes(needle) ||
        entry.item.ownerName.toLowerCase().includes(needle) ||
        entry.item.tags.some((tag) => tag.includes(needle)),
    )
  }, [entries, needle])

  // ── Infinite scroll ──────────────────────────────────────
  // Everything is already in memory; this pages the RENDER, which is what keeps
  // a large feed from mounting hundreds of <Image> elements at once.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const revealKey = `${queryKey}|${needle}`
  const visible = reveal.key === revealKey ? reveal.count : PAGE_SIZE
  const hasMore = visible < filtered.length

  const loadMore = useCallback(() => {
    setReveal((prev) => {
      const current = prev.key === revealKey ? prev.count : PAGE_SIZE
      return { key: revealKey, count: Math.min(current + PAGE_SIZE, filtered.length) }
    })
  }, [revealKey, filtered.length])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed[0]?.isIntersecting) loadMore()
      },
      // Start the next page before the sentinel is actually on screen so the
      // scroll never visibly stalls.
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const shown = density === 'grid' ? filtered : filtered.slice(0, visible)
  const isEmpty = !loading && filtered.length === 0

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-text sm:text-3xl">Marketplace</h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Everything creators make in the Art Studio — artwork, tees, hoodies, caps and posters.
        </p>
      </header>

      {/* ── Controls ─────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Marketplace section"
            className="flex gap-1 rounded-full border border-bg-border bg-bg-card p-1"
          >
            {(
              [
                ['all', 'Everything'],
                ['art', 'Artwork'],
                ['merch', 'Merch'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  tab === id ? 'bg-studio-art/15 text-studio-art' : 'text-text-secondary hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <label htmlFor="marketplace-search" className="sr-only">
              Search the marketplace
            </label>
            <input
              id="marketplace-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search designs, creators, tags…"
              className="input-base w-full rounded-full pl-9"
            />
          </div>

          <div>
            <label htmlFor="marketplace-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="marketplace-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as MarketSort)}
              className="input-base rounded-full"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Density toggle — a feed to browse, a grid to scan. */}
          <div
            role="group"
            aria-label="Layout"
            className="ml-auto flex gap-1 rounded-full border border-bg-border bg-bg-card p-1"
          >
            {(
              [
                ['feed', 'Feed', Rows3],
                ['grid', 'Grid', LayoutGrid],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDensity(id)}
                aria-pressed={density === id}
                className={cn(
                  'rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  density === id ? 'bg-studio-art/15 text-studio-art' : 'text-text-secondary hover:text-text',
                )}
                aria-label={`${label} layout`}
              >
                <Icon size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {tab !== 'merch' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter artwork by category">
            <button
              type="button"
              onClick={() => setCategory('all')}
              aria-pressed={category === 'all'}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                category === 'all'
                  ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                  : 'border-bg-border text-text-secondary hover:text-text',
              )}
            >
              All art
            </button>
            {ART_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  category === item
                    ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                    : 'border-bg-border text-text-secondary hover:text-text',
                )}
              >
                {item.replace('-', ' ')}
              </button>
            ))}
          </div>
        )}

        {tab !== 'art' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by product type">
            <button
              type="button"
              onClick={() => setProductType('all')}
              aria-pressed={productType === 'all'}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                productType === 'all'
                  ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                  : 'border-bg-border text-text-secondary hover:text-text',
              )}
            >
              All products
            </button>
            {PRODUCT_CATALOG.map((product) => (
              <button
                key={product.type}
                type="button"
                onClick={() => setProductType(product.type)}
                aria-pressed={productType === product.type}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  productType === product.type
                    ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                    : 'border-bg-border text-text-secondary hover:text-text',
                )}
              >
                {product.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Stream ───────────────────────────────────────── */}
      {loading ? (
        density === 'grid' ? (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" aria-label="Loading listing…" />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-[560px] space-y-8">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" aria-label="Loading post…" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="aspect-square w-full rounded-2xl" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
        )
      ) : error ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-5 text-center" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="btn-ghost mt-3 px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-16 text-center">
          <Store size={30} className="text-text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-text">
            {needle ? 'Nothing matches that search' : 'Nothing here yet'}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
            {needle
              ? 'Try a different search or clear the filters.'
              : 'The marketplace fills up as creators publish from the Art Studio. Be the first.'}
          </p>
          {!needle && (
            <Link href="/create/art" className="btn-accent mt-5 inline-flex px-4 py-2 text-sm">
              Open Art Studio
            </Link>
          )}
        </div>
      ) : density === 'grid' ? (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:grid-cols-5">
          {shown.map((entry) => (
            <GridTile key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-[560px] space-y-6">
            {shown.map((entry, index) => (
              // The first post is above the fold on every viewport, so its image
              // is the LCP candidate and is fetched eagerly.
              <FeedPost key={entry.id} entry={entry} priority={index === 0} />
            ))}
          </div>

          {/* Infinite-scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8" aria-hidden="true">
              <Loader2
                size={20}
                className="animate-spin text-text-muted motion-reduce:animate-none"
              />
            </div>
          )}
          {!hasMore && filtered.length > PAGE_SIZE && (
            <p className="py-8 text-center text-xs text-text-muted">You&apos;re all caught up.</p>
          )}
        </>
      )}
    </div>
  )
}
