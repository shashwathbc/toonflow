'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search, SlidersHorizontal, BookOpen, Layers, Eye, Star, X, ChevronDown,
} from 'lucide-react'
import { browseContent, searchContent } from '@/lib/firebase/firestore'
import { formatCount } from '@/lib/utils/formatters'
import { GENRES } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import type { Novel, Webtoon } from '@/types'
import toast from 'react-hot-toast'

type SortBy = 'trending' | 'newest' | 'rating'
type ContentType = 'all' | 'novel' | 'webtoon'

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
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen size={24} className="text-white/20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white capitalize border border-white/10">
            {type === 'novel' ? 'Novel' : 'Webtoon'}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">{item.title}</h3>
        {item.genres?.length > 0 && (
          <p className="text-[11px] text-white/50 mb-1.5 truncate">{item.genres.slice(0, 2).join(' · ')}</p>
        )}
        <div className="flex items-center gap-2.5 text-[11px] text-white/40">
          <span className="flex items-center gap-1"><Layers size={10} aria-hidden="true" />{chapterCount}</span>
          <span className="flex items-center gap-1"><Eye size={10} aria-hidden="true" />{formatCount(item.viewCount)}</span>
          {item.rating > 0 && (
            <span className="flex items-center gap-1"><Star size={10} aria-hidden="true" />{item.rating.toFixed(1)}</span>
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

export function BrowseClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [contentType, setContentType] = useState<ContentType>(
    (searchParams.get('type') as ContentType) ?? 'all'
  )
  const [sortBy, setSortBy] = useState<SortBy>('trending')
  const [genre, setGenre] = useState<string>(searchParams.get('genre') ?? '')
  const [status, setStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [items, setItems] = useState<Array<{ item: Novel | Webtoon; type: 'novel' | 'webtoon' }>>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (searchQuery.trim()) {
        const { novels, webtoons } = await searchContent(searchQuery.trim(), 48)
        const filtered = [
          ...(contentType !== 'webtoon' ? novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })) : []),
          ...(contentType !== 'novel' ? webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })) : []),
        ]
        setItems(filtered)
      } else {
        const { novels, webtoons } = await browseContent({
          contentType,
          genre: genre || undefined,
          status: status || undefined,
          sortBy,
          limitCount: 48,
        })
        setItems([
          ...novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })),
          ...webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })),
        ])
      }
    } catch (err) {
      console.error('[Browse] load error:', err)
      toast.error('Failed to load content')
    } finally {
      setLoading(false)
    }
  }, [contentType, genre, status, sortBy, searchQuery])

  useEffect(() => { load() }, [load])

  function handleSearchInput(val: string) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearchQuery(val), 400)
  }

  function clearFilters() {
    setGenre('')
    setStatus('')
    setSortBy('trending')
    setSearchInput('')
    setSearchQuery('')
    setContentType('all')
  }

  const hasActiveFilters = genre || status || sortBy !== 'trending' || contentType !== 'all' || searchQuery

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
          onClick={() => setSidebarOpen((v) => !v)}
          className="btn-ghost text-sm md:hidden"
          aria-label="Toggle filters"
          aria-expanded={sidebarOpen ? 'true' : 'false'}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search novels and webtoons…"
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="input-base pl-10 pr-10 w-full"
          aria-label="Search content"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setSearchQuery('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content type tabs */}
      <div role="tablist" aria-label="Content type" className="flex gap-1 mb-6 border-b border-bg-border">
        {(['all', 'novel', 'webtoon'] as ContentType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={contentType === t ? 'true' : 'false'}
            onClick={() => setContentType(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-all capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t',
              contentType === t
                ? 'border-accent text-accent'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            {t === 'all' ? 'All' : t === 'novel' ? 'Novels' : 'Webtoons'}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <aside
          className={cn(
            'w-52 shrink-0 space-y-6',
            sidebarOpen ? 'block' : 'hidden md:block'
          )}
          aria-label="Content filters"
        >
          {/* Sort */}
          <fieldset>
            <legend className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-3">Sort By</legend>
            <div className="space-y-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortBy(opt.value)}
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
                  onClick={() => setStatus(opt.value)}
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

          {/* Genres */}
          <fieldset>
            <legend className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-3">Genre</legend>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent capitalize',
                    genre === g
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg text-white/50 border-bg-border hover:border-white/30 hover:text-white'
                  )}
                  {...(genre === g ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
                >
                  {g}
                </button>
              ))}
            </div>
          </fieldset>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-danger hover:text-white border border-danger/30 hover:border-white/30 rounded-lg py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X size={12} aria-hidden="true" /> Clear All Filters
            </button>
          )}
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
              {items.map(({ item, type }) => (
                <ContentCard key={`${type}-${item.id}`} item={item} type={type} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
