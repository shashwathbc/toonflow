'use client'

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tooltip } from '@/components/ui/Tooltip'
import { BookOpen, Tv2, Eye, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { getTrendingNovels, getTrendingWebtoons } from '@/lib/firebase/firestore'
import { cachedRequest } from '@/lib/utils/requestCache'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { Novel, Webtoon } from '@/types'

type SlideItem = { item: Novel | Webtoon; type: 'novel' | 'webtoon' }

const SLIDE_INTERVAL = 6000

/**
 * prefers-reduced-motion as a subscription rather than a one-shot read, so
 * flipping the OS setting takes effect without a reload. useSyncExternalStore
 * keeps SSR honest: the server snapshot is `false` (animate), matching what the
 * client renders before hydration, so there's no mismatch.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  )
}

function HeroSliderSkeleton() {
  return (
    <div className="relative min-h-[440px] sm:min-h-[520px] lg:min-h-[580px] bg-bg-elevated overflow-hidden">
      <div className="absolute inset-0 shimmer" />
      <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 pb-14 pt-8 flex items-end min-h-[440px] sm:min-h-[520px] lg:min-h-[580px]">
        <div className="space-y-4 max-w-xl w-full">
          <div className="h-6 w-32 bg-bg-card rounded-full" />
          <div className="h-12 sm:h-14 w-full max-w-md bg-bg-card rounded-lg" />
          <div className="h-12 sm:h-14 w-2/3 max-w-xs bg-bg-card rounded-lg" />
          <div className="h-4 w-full max-w-sm bg-bg-card rounded" />
          <div className="flex gap-3 pt-2">
            <div className="h-11 w-36 bg-bg-card rounded-xl" />
            <div className="h-11 w-28 bg-bg-card rounded-xl" />
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
  // Hover/focus suspends rotation transiently; the toggle is a persistent user
  // choice. Kept separate so moving the mouse away doesn't resume a carousel
  // the user explicitly paused (WCAG 2.2.2).
  const [suspended, setSuspended] = useState(false)
  const [userPaused, setUserPaused] = useState(false)

  const reducedMotion = usePrefersReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Autoplay is off entirely under reduced motion — an auto-advancing carousel
  // is exactly the kind of unrequested movement that setting asks us to stop.
  const isRotating = !loading && slides.length > 1 && !suspended && !userPaused && !reducedMotion

  useEffect(() => {
    let cancelled = false

    // Same cache keys as HomeFeed — one pair of Firestore queries serves
    // both components; the hero just takes the top 5 of the 12 fetched.
    Promise.all([
      cachedRequest('trending-novels-12', 60_000, () => getTrendingNovels(12)),
      cachedRequest('trending-webtoons-12', 60_000, () => getTrendingWebtoons(12)),
    ])
      .then(([novels, webtoons]) => {
        if (cancelled) return
        const combined: SlideItem[] = [
          ...novels.map((n) => ({ item: n, type: 'novel' as const })),
          ...webtoons.map((w) => ({ item: w, type: 'webtoon' as const })),
        ]
          .sort((a, b) => b.item.viewCount - a.item.viewCount)
          .slice(0, 5)
        setSlides(combined)
      })
      .catch((e) => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const count = slides.length

  const goTo = useCallback((i: number) => {
    setCurrent((c) => (count > 0 ? ((i % count) + count) % count : c))
  }, [count])

  const next = useCallback(() => setCurrent((c) => (count > 0 ? (c + 1) % count : c)), [count])
  const prev = useCallback(() => setCurrent((c) => (count > 0 ? (c - 1 + count) % count : c)), [count])

  useEffect(() => {
    if (!isRotating) return
    timerRef.current = setInterval(next, SLIDE_INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRotating, next])

  // Arrow keys drive the carousel, but only while focus is inside it — a global
  // listener would hijack arrow keys for the whole page.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  }, [next, prev])

  if (loading) return <HeroSliderSkeleton />

  if (count === 0) {
    return (
      <section
        className="relative min-h-[380px] sm:min-h-[420px] bg-bg-elevated flex items-end"
        aria-label="Featured content"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 pb-12 space-y-4 w-full">
          <span className="eyebrow inline-block text-text-secondary bg-bg-elevated border border-bg-border rounded-full px-3 py-1.5">
            Trending Now
          </span>
          <h1 className="display-2xl text-white max-w-xl">Discover Epic Stories</h1>
          <p className="text-body max-w-md">
            Read the latest webtoons and novels from creators around the world.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link href="/browse" className="btn-accent">
              <BookOpen size={16} aria-hidden="true" />
              Browse Now
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const active = slides[current]
  const activeHref = `/${active.type}/${active.item.id}`

  return (
    <section
      className="relative min-h-[440px] sm:min-h-[520px] lg:min-h-[580px] overflow-hidden isolate"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured stories"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setSuspended(true)}
      onMouseLeave={() => setSuspended(false)}
      onFocusCapture={() => setSuspended(true)}
      onBlurCapture={(e) => {
        // Only resume once focus has genuinely left the carousel, not when it
        // moves between the arrows and the dots inside it.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSuspended(false)
      }}
    >
      {/* Background layers — every slide stays mounted so opacity can actually
          crossfade. (The previous version swapped `src` on a single <Image>,
          so the transition class had nothing to animate and each change was a
          hard cut with a decode flash.) */}
      <div className="absolute inset-0 -z-10">
        {slides.map(({ item }, i) => {
          const bg = ('bannerURL' in item && item.bannerURL) ? item.bannerURL : item.coverURL
          if (!bg) return null
          return (
            <Image
              key={item.id}
              src={bg}
              alt=""
              aria-hidden="true"
              fill
              // Only the first slide is LCP-critical; the rest load right after
              // and are ready well before their turn comes up.
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              sizes="100vw"
              quality={80}
              className={cn(
                'object-cover object-top transition-opacity duration-700 ease-out motion-reduce:transition-none',
                i === current ? 'opacity-100' : 'opacity-0'
              )}
            />
          )
        })}
      </div>

      {/* Scrim. Deeper and wider than before: the copy sits on the left third,
          and at the old `via-bg/75 … to-bg/20` the text ran over bright artwork
          well under 4.5:1. A vertical pass anchors the bottom controls too. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/90 to-bg/30 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/20 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Live region: silent while rotating (announcing every 6s is noise), and
          polite once stopped, so manual navigation IS announced. */}
      <div
        className="relative max-w-screen-xl mx-auto px-4 sm:px-6 pb-16 pt-10 flex items-end min-h-[440px] sm:min-h-[520px] lg:min-h-[580px] w-full"
        // spread instead of an inline expression: the static ARIA scanner can't
        // evaluate expressions and flags them (same workaround as the dots below)
        {...(isRotating ? { 'aria-live': 'off' as const } : { 'aria-live': 'polite' as const })}
        aria-atomic="true"
      >
        <div
          className="space-y-4 max-w-xl"
          role="group"
          aria-roledescription="slide"
          aria-label={`${current + 1} of ${count}: ${active.item.title}`}
        >
          {/* Type + rank badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 eyebrow text-white bg-white/15 border border-white/25 rounded-full px-3 py-1.5 backdrop-blur-sm">
              {active.type === 'novel'
                ? <BookOpen size={12} aria-hidden="true" />
                : <Tv2 size={12} aria-hidden="true" />}
              {active.type === 'novel' ? 'Novel' : 'Webtoon'}
            </span>
            <span className="eyebrow text-text-secondary bg-bg-elevated/80 border border-bg-border rounded-full px-3 py-1.5 backdrop-blur-sm tnum">
              #{current + 1} Trending
            </span>
          </div>

          {/* Title — 2 lines max. At 3 the headline swallowed the whole hero and
              pushed the CTA off the fold on short viewports. */}
          {/* pb-2: display-2xl's tight leading-[1.02] + line-clamp's overflow:hidden
              clip descenders (g/y/p) on the last line — the padding gives them room. */}
          <h1 className="display-2xl text-white line-clamp-2 pb-2">
            {toTitleCase(active.item.title)}
          </h1>

          {/* Genres */}
          {active.item.genres?.length > 0 && (
            <ul className="flex items-center gap-2 flex-wrap" aria-label="Genres">
              {active.item.genres.slice(0, 3).map((g) => (
                <li
                  key={g}
                  className="text-xs font-medium text-white/90 capitalize bg-white/12 border border-white/10 rounded-full px-2.5 py-1"
                >
                  {g}
                </li>
              ))}
            </ul>
          )}

          {/* Synopsis */}
          <p className="text-body text-white/85 line-clamp-2 max-w-lg">
            {active.item.synopsis}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-[13px] text-white/75">
            <span className="flex items-center gap-1.5 tnum" title="Views">
              <Eye size={13} aria-hidden="true" />
              {formatCount(active.item.viewCount)} views
            </span>
            <span aria-hidden="true" className="w-px h-3 bg-white/25" />
            <span className="capitalize" title="Publication status">{active.item.status}</span>
          </div>

          {/* CTA — min 44px tall for touch (WCAG 2.5.8) */}
          <div className="flex items-center gap-3 pt-2">
            <Link href={activeHref} className="btn-accent px-5 py-2.5 min-h-[44px] text-[15px]">
              <Play size={15} aria-hidden="true" />
              Read Now
            </Link>
            <Link
              href="/browse"
              className="btn-ghost px-5 py-2.5 min-h-[44px] text-[15px] text-white/90 border border-white/20 hover:border-white/40"
            >
              Browse All
            </Link>
          </div>
        </div>
      </div>

      {count > 1 && (
        <>
          {/* Prev / Next — 44px hit area, hidden from SR on small screens where
              the dots already provide navigation. */}
          <Tooltip label="Previous slide">
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 border border-white/15 hidden sm:flex items-center justify-center text-white/80 hover:bg-black/70 hover:text-white hover:border-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label="Next slide">
            <button
              type="button"
              onClick={next}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 border border-white/15 hidden sm:flex items-center justify-center text-white/80 hover:bg-black/70 hover:text-white hover:border-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Next slide"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Dots + pause. Plain buttons with aria-current — NOT role="tab",
              which the old markup used without any matching tabpanel and so
              described a widget that didn't exist. */}
          <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-3 px-4">
            <div className="flex items-center gap-2" role="group" aria-label="Choose slide">
              {slides.map(({ item }, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}: ${item.title}`}
                  {...(i === current ? { 'aria-current': 'true' as const } : {})}
                  className="group relative h-11 flex items-center focus-visible:outline-none"
                >
                  {/* Visual bar sits inside a 44px-tall transparent hit area:
                      the target meets WCAG 2.5.8 without a chunky UI. */}
                  <span
                    className={cn(
                      'block rounded-full transition-all duration-300 overflow-hidden group-focus-visible:ring-2 group-focus-visible:ring-white group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg',
                      i === current
                        ? 'w-8 h-1.5 bg-white/30'
                        : 'w-1.5 h-1.5 bg-white/40 group-hover:bg-white/70'
                    )}
                  >
                    {i === current && (
                      <span
                        // Re-keyed per slide so the fill restarts each advance.
                        key={`${current}-${isRotating}`}
                        className={cn('block h-full w-full bg-white rounded-full', isRotating && 'hero-dot-progress')}
                        style={{ '--slide-duration': `${SLIDE_INTERVAL}ms` } as React.CSSProperties}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* WCAG 2.2.2: anything that auto-updates needs a way to stop it.
                Hidden under reduced motion — nothing is moving to pause. */}
            {!reducedMotion && (
              <Tooltip label={userPaused ? 'Play slideshow' : 'Pause slideshow'}>
                <button
                  type="button"
                  onClick={() => setUserPaused((p) => !p)}
                  className="w-11 h-11 -mr-1 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
                >
                  {userPaused
                    ? <Play size={15} aria-hidden="true" />
                    : <Pause size={15} aria-hidden="true" />}
                </button>
              </Tooltip>
            )}
          </div>
        </>
      )}
    </section>
  )
}
