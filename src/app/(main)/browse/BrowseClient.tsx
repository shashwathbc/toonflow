'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CoverImage from '@/components/content/CoverImage'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Search, SlidersHorizontal, BookOpen, Clapperboard, Film, Layers, Eye, Star, X,
} from 'lucide-react'
import { browseContent, searchContent } from '@/lib/firebase/firestore'
import { listPublishedAnime } from '@/lib/firebase/anime'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { Stat } from '@/components/ui/Stat'
import { GENRES } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel, Webtoon } from '@/types'
import type { AnimeProject } from '@/types/anime'
import toast from 'react-hot-toast'

type SortBy = 'trending' | 'newest' | 'rating'
type ContentType = 'all' | 'novel' | 'webtoon' | 'anime'

/** A catalog row, whatever its underlying content type. */
type CatalogEntry =
  | { type: 'novel'; item: Novel }
  | { type: 'webtoon'; item: Webtoon }
  | { type: 'anime'; item: AnimeProject }

const TYPE_LABEL: Record<CatalogEntry['type'], string> = {
  novel: 'Novel',
  webtoon: 'Webtoon',
  anime: 'Anime',
}

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: 'Popular', value: 'trending' },
  { label: 'Newest', value: 'newest' },
  { label: 'Highest Rated', value: 'rating' },
]

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
]

function ContentCard({ entry }: { entry: CatalogEntry }) {
  const { type } = entry

  // Each content type counts its parts differently and lives at its own route.
  // Normalising here keeps ONE card for the whole catalog rather than a
  // near-duplicate per type.
  const isAnime = type === 'anime'
  const item = entry.item
  const partCount = isAnime
    ? (entry.item as AnimeProject).sceneCount
    : 'chapterCount' in item
      ? (item as Novel).chapterCount
      : (item as Webtoon).episodeCount
  const href = isAnime ? `/anime/${item.id}` : `/${type}/${item.id}`
  const unitLabel = type === 'novel' ? 'Chapters' : type === 'webtoon' ? 'Episodes' : 'Scenes'
  const coverURL = isAnime ? (entry.item as AnimeProject).thumbnailURL : (item as Novel).coverURL
  const genres = item.genres ?? []
  // Anime carries no star rating yet — showing 0.0 would read as "rated badly"
  // rather than "not rated", so the stat is simply omitted.
  const rating = isAnime ? 0 : (item as Novel).rating

  // Folded into the link label because aria-label overrides inner content.
  const cardLabel = [
    `${item.title} — ${TYPE_LABEL[type].toLowerCase()}`,
    `${partCount} ${unitLabel.toLowerCase()}`,
    `${formatCount(item.viewCount)} views`,
    rating > 0 ? `rated ${rating.toFixed(1)} out of 5` : null,
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
        <CoverImage
          src={coverURL}
          alt={item.title}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white capitalize border border-white/10 inline-flex items-center gap-1">
            {isAnime && <Clapperboard size={9} aria-hidden="true" />}
            {TYPE_LABEL[type]}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">{toTitleCase(item.title)}</h3>
        {genres.length > 0 && (
          <p className="text-[11px] text-white/50 mb-1.5 truncate">{genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-2.5 text-[11px] text-white/60">
          <Stat icon={isAnime ? Film : Layers} value={partCount} label={unitLabel} />
          <Stat icon={Eye} value={formatCount(item.viewCount)} label="Views" />
          {rating > 0 && (
            <Stat icon={Star} value={rating.toFixed(1)} label="Rating" />
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

interface FilterControlsProps {
  sortBy: SortBy
  onSortChange: (v: SortBy) => void
  status: string
  onStatusChange: (v: string) => void
  genres: string[]
  onToggleGenre: (g: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

/** The filter controls, shared by the desktop sidebar and the mobile modal. */
function FilterControls({
  sortBy, onSortChange, status, onStatusChange, genres, onToggleGenre, hasActiveFilters, onClearFilters,
}: FilterControlsProps) {
  return (
    <div className="space-y-6">
      {/* Sort */}
      <fieldset>
        <legend className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-3">Sort By</legend>
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSortChange(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                sortBy === opt.value
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}
              {...(sortBy === opt.value ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Status */}
      <fieldset>
        <legend className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-3">Status</legend>
        <div className="space-y-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                status === opt.value
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}
              {...(status === opt.value ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Genres — multi-select (any-of) */}
      <fieldset>
        <legend className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-3">
          Genre{genres.length > 0 && <span className="text-accent normal-case tracking-normal"> · {genres.length}</span>}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => {
            const selected = genres.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => onToggleGenre(g)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent capitalize',
                  selected
                    ? 'bg-accent/10 text-accent border-accent/30'
                    : 'bg-bg text-white/50 border-bg-border hover:border-white/30 hover:text-white'
                )}
                {...(selected ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
              >
                {g}
              </button>
            )
          })}
        </div>
      </fieldset>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-danger hover:text-white border border-danger/30 hover:border-white/30 rounded-lg py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={12} aria-hidden="true" /> Clear All Filters
        </button>
      )}
    </div>
  )
}

export function BrowseClient() {
  const searchParams = useSearchParams()

  const [contentType, setContentType] = useState<ContentType>(
    (searchParams.get('type') as ContentType) ?? 'all'
  )
  const [sortBy, setSortBy] = useState<SortBy>('trending')
  const [genres, setGenres] = useState<string[]>(() => {
    const g = searchParams.get('genre')
    return g ? [g] : []
  })
  const [status, setStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [items, setItems] = useState<CatalogEntry[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // loading derives from "have the current filters been loaded" so the load
  // effect never calls setState synchronously (react-hooks/set-state-in-effect)
  const filterKey = `${contentType}|${[...genres].sort().join(',')}|${status}|${sortBy}|${searchQuery}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== filterKey

  // Monotonic request id. Firestore queries resolve out of order — a broad
  // filter can easily outlive a narrower one issued after it — so without this
  // a slow earlier response overwrites a fast later one and the grid shows
  // results that don't match the active filters. Only the newest request is
  // allowed to commit. This also doubles as the unmount guard: the ref is
  // bumped on cleanup, so no in-flight response can setState after unmount.
  const requestId = useRef(0)

  useEffect(() => () => { requestId.current += 1 }, [])

  const load = useCallback(() => {
    const id = ++requestId.current
    const isCurrent = () => id === requestId.current

    const request = searchQuery.trim()
      ? Promise.all([
          searchContent(searchQuery.trim(), 48),
          // Firestore has no substring search, so anime is filtered in memory
          // the same way the novel/webtoon search already works.
          contentType === 'novel' || contentType === 'webtoon'
            ? Promise.resolve([] as AnimeProject[])
            : listPublishedAnime({ sortBy, limitCount: 48 }),
        ]).then(([{ novels, webtoons }, anime]) => {
          if (!isCurrent()) return
          const needle = searchQuery.trim().toLowerCase()
          setItems([
            ...(contentType === 'all' || contentType === 'novel'
              ? novels.map((n): CatalogEntry => ({ type: 'novel', item: n }))
              : []),
            ...(contentType === 'all' || contentType === 'webtoon'
              ? webtoons.map((w): CatalogEntry => ({ type: 'webtoon', item: w }))
              : []),
            ...anime
              .filter(
                (a) =>
                  a.title.toLowerCase().includes(needle) ||
                  a.description.toLowerCase().includes(needle),
              )
              .map((a): CatalogEntry => ({ type: 'anime', item: a })),
          ])
        })
      : Promise.all([
          contentType === 'anime'
            ? Promise.resolve({ novels: [] as Novel[], webtoons: [] as Webtoon[] })
            : browseContent({
                contentType: contentType === 'all' ? 'all' : contentType,
                genres: genres.length ? genres : undefined,
                status: status || undefined,
                sortBy,
                limitCount: 48,
              }),
          // Anime has no ongoing/completed lifecycle, so a status filter simply
          // excludes it rather than returning titles that don't match.
          (contentType === 'all' || contentType === 'anime') && !status
            ? listPublishedAnime({
                genres: genres.length ? genres : undefined,
                sortBy,
                limitCount: 48,
              })
            : Promise.resolve([] as AnimeProject[]),
        ]).then(([{ novels, webtoons }, anime]) => {
          if (!isCurrent()) return
          setItems([
            ...novels.map((n): CatalogEntry => ({ type: 'novel', item: n })),
            ...webtoons.map((w): CatalogEntry => ({ type: 'webtoon', item: w })),
            ...anime.map((a): CatalogEntry => ({ type: 'anime', item: a })),
          ])
        })

    request
      .catch((err) => {
        if (!isCurrent()) return
        console.error('[Browse] load error:', err)
        toast.error('Failed to load content')
      })
      .finally(() => {
        if (isCurrent()) setLoadedKey(filterKey)
      })
  }, [contentType, genres, status, sortBy, searchQuery, filterKey])

  useEffect(() => { load() }, [load])

  // The search debounce is cleared on the next keystroke, but nothing cleared it
  // on unmount — navigating away mid-debounce left a pending timer holding the
  // component's state setters. (The admin list pages already do this.)
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
  }, [])

  function handleSearchInput(val: string) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearchQuery(val), 400)
  }

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  function clearFilters() {
    setGenres([])
    setStatus('')
    setSortBy('trending')
    setSearchInput('')
    setSearchQuery('')
    setContentType('all')
  }

  const hasActiveFilters = Boolean(genres.length > 0 || status || sortBy !== 'trending' || contentType !== 'all' || searchQuery)
  // Count of filters controlled inside the sidebar/modal (search + content-type
  // live outside it), used for the mobile Filters button badge.
  const activeFilterCount = genres.length + (status ? 1 : 0) + (sortBy !== 'trending' ? 1 : 0)

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse</h1>
          <p className="text-white/50 text-sm mt-1">
            {loading ? 'Loading…' : `${items.length} result${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="btn-ghost text-sm md:hidden relative"
          aria-label="Open filters"
          {...(sidebarOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-accent text-accent-foreground text-[11px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search novels, webtoons and anime…"
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="input-base pl-10 pr-10 w-full"
          aria-label="Search content"
        />
        {searchInput && (
          <Tooltip label="Clear search" side="left">
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearchQuery('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded"
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Content type tabs */}
      <div role="tablist" aria-label="Content type" className="flex gap-1 mb-6 border-b border-bg-border">
        {(['all', 'novel', 'webtoon', 'anime'] as ContentType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            {...(contentType === t ? { 'aria-selected': 'true' } : { 'aria-selected': 'false' })}
            onClick={() => setContentType(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-all capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t',
              contentType === t
                ? 'border-accent text-accent'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            {t === 'all' ? 'All' : t === 'novel' ? 'Novels' : t === 'webtoon' ? 'Webtoons' : 'Anime'}
          </button>
        ))}
      </div>

      {/* Mobile filter modal — a light bottom sheet: dim (not blackout) backdrop
          and a compact height so the browse content behind stays visible and the
          user never feels cut off from what they were reading. */}
      <Dialog.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in md:hidden" />
          <Dialog.Content
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-bg-border bg-bg-card shadow-2xl data-[state=open]:animate-slide-up focus:outline-none md:hidden"
            aria-describedby={undefined}
          >
            {/* Grab handle — signals the sheet is dismissible */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-white/20 hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close filters"
            />

            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <Dialog.Title className="text-base font-semibold text-white">Filters</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="btn-ghost p-1.5 rounded-lg" aria-label="Close filters">
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-5 pb-4 overflow-y-auto flex-1">
              <FilterControls
                sortBy={sortBy}
                onSortChange={setSortBy}
                status={status}
                onStatusChange={setStatus}
                genres={genres}
                onToggleGenre={toggleGenre}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            </div>

            <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-bg-border shrink-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="btn-accent w-full justify-center"
              >
                {loading ? 'Show results' : `Show ${items.length} result${items.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex gap-6">
        {/* Filter sidebar — desktop only; mobile uses the modal above */}
        <aside className="hidden md:block w-52 shrink-0" aria-label="Content filters">
          <FilterControls
            sortBy={sortBy}
            onSortChange={setSortBy}
            status={status}
            onStatusChange={setStatus}
            genres={genres}
            onToggleGenre={toggleGenre}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </aside>

        {/* Results grid */}
        <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen size={40} className="text-white/20 mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white mb-2">No results found</h2>
              <p className="text-white/50 text-sm mb-4">
                {searchQuery ? `No content matching "${searchQuery}"` : 'No content matches the current filters.'}
              </p>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="btn-ghost text-sm">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              aria-live="polite"
              aria-label="Content results"
            >
              {items.map((entry) => (
                <ContentCard key={`${entry.type}-${entry.item.id}`} entry={entry} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
