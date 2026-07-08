'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tooltip } from '@/components/ui/Tooltip'
import { BookOpen, Tv2, Eye, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { getTrendingNovels, getTrendingWebtoons } from '@/lib/firebase/firestore'
import { cachedRequest } from '@/lib/utils/requestCache'
import { formatCount } from '@/lib/utils/formatters'
import type { Novel, Webtoon } from '@/types'

type SlideItem = { item: Novel | Webtoon; type: 'novel' | 'webtoon' }

const SLIDE_INTERVAL = 6000

function HeroSliderSkeleton() {
  return (
    <div className="relative min-h-[500px] md:min-h-[580px] bg-bg-elevated animate-pulse">
      <div className="absolute inset-0 bg-bg-elevated" />
      <div className="relative max-w-screen-xl mx-auto px-4 pb-16 pt-8 flex items-end min-h-[500px] md:min-h-[580px]">
        <div className="space-y-4 max-w-lg">
          <div className="h-5 w-24 bg-bg-card rounded-full" />
          <div className="h-12 w-80 bg-bg-card rounded-lg" />
          <div className="h-4 w-96 bg-bg-card rounded" />
          <div className="h-4 w-72 bg-bg-card rounded" />
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-32 bg-bg-card rounded-xl" />
            <div className="h-10 w-24 bg-bg-card rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeroSlider() {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Same cache keys as HomeFeed — one pair of Firestore queries serves
    // both components; the hero just takes the top 5 of the 12 fetched.
    Promise.all([
      cachedRequest('trending-novels-12', 60_000, () => getTrendingNovels(12)),
      cachedRequest('trending-webtoons-12', 60_000, () => getTrendingWebtoons(12)),
    ])
      .then(([novels, webtoons]) => {
        const combined: SlideItem[] = [
          ...novels.map((n) => ({ item: n, type: 'novel' as const })),
          ...webtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
        ]
          .sort((a, b) => b.item.viewCount - a.item.viewCount)
          .slice(0, 5)
        setSlides(combined)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length)
  }, [slides.length])

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length)
  }, [slides.length])

  useEffect(() => {
    if (slides.length === 0 || paused) return
    timerRef.current = setInterval(next, SLIDE_INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [slides.length, paused, next])

  if (loading) return <HeroSliderSkeleton />

  if (slides.length === 0) {
    return (
      <section
        className="relative min-h-[420px] bg-bg-elevated flex items-end"
        aria-label="Featured content"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="relative max-w-screen-xl mx-auto px-4 pb-12 space-y-4 w-full">
          <span className="text-xs font-semibold text-white/50 tracking-widest uppercase bg-bg-elevated border border-bg-border rounded-full px-3 py-1">
            ✦ Trending Now
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white max-w-xl leading-tight">
            Discover Epic Stories
          </h1>
          <p className="text-white/60 max-w-md">
            Read the latest webtoons and novels from creators around the world.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/browse" className="btn-accent">
              <BookOpen size={16} aria-hidden="true" />
              Browse Now
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const { item, type } = slides[current]
  const bgImage = ('bannerURL' in item && item.bannerURL) ? item.bannerURL : item.coverURL
  const href = `/${type}/${item.id}`

  return (
    <section
      className="relative min-h-[500px] md:min-h-[580px] overflow-hidden"
      aria-label="Featured content slider"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background image */}
      {bgImage && (
        <div className="absolute inset-0">
          <Image
            src={bgImage}
            alt=""
            fill
            className="object-cover object-top transition-opacity duration-700"
            priority
            sizes="100vw"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent pointer-events-none" />

      {/* Slide content */}
      <div
        className="relative max-w-screen-xl mx-auto px-4 pb-16 pt-8 flex items-end min-h-[500px] md:min-h-[580px] w-full"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="space-y-4 max-w-lg">
          {/* Type + rank badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 text-white border border-white/20 rounded-full px-3 py-1">
              {type === 'novel' ? <BookOpen size={11} aria-hidden="true" /> : <Tv2 size={11} aria-hidden="true" />}
              {type === 'novel' ? 'Novel' : 'Webtoon'}
            </span>
            <span className="text-xs font-semibold text-white/50 tracking-widest uppercase bg-bg-elevated/70 border border-bg-border rounded-full px-3 py-1">
              #{current + 1} Trending
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight line-clamp-3">
            {item.title}
          </h1>

          {/* Genres */}
          {item.genres?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.genres.slice(0, 3).map((g) => (
                <span key={g} className="text-[11px] text-white/60 capitalize bg-white/10 rounded-full px-2.5 py-0.5">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <p className="text-white/70 text-sm leading-relaxed line-clamp-2 max-w-md">
            {item.synopsis}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Eye size={11} aria-hidden="true" />
              {formatCount(item.viewCount)} views
            </span>
            <span className="capitalize">{item.status}</span>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3 pt-1">
            <Link href={href} className="btn-accent">
              <Play size={14} aria-hidden="true" />
              Read Now
            </Link>
            <Link href="/browse" className="btn-ghost text-sm">
              Browse All
            </Link>
          </div>
        </div>
      </div>

      {/* Prev / Next arrows */}
      {slides.length > 1 && (
        <>
          <Tooltip label="Previous slide">
            <button
              type="button"
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:bg-black/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Previous slide"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label="Next slide">
            <button
              type="button"
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:bg-black/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Next slide"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </>
      )}

      {/* Dot navigation */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2" role="tablist" aria-label="Slide navigation">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              // spread instead of an inline expression: Edge Tools' static
              // ARIA scanner can't evaluate expressions and flags them
              {...(i === current ? { 'aria-selected': 'true' as const } : { 'aria-selected': 'false' as const })}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                i === current
                  ? 'w-6 h-2 bg-accent'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
