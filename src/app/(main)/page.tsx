import type { Metadata } from 'next'
import { BookOpen, Tv2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Home — Read Webtoons & Manga',
}

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero placeholder */}
      <section
        className="relative min-h-[480px] bg-bg-elevated flex items-end"
        aria-label="Featured content"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent pointer-events-none" />
        <div className="relative max-w-screen-xl mx-auto px-4 pb-12 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase bg-bg-elevated border border-bg-border rounded-full px-3 py-1">
              ✦ Trending Now
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-text max-w-xl leading-tight">
            Discover Epic Stories
          </h1>
          <p className="text-text-secondary max-w-md">
            Read the latest webtoons and manga from creators around the world.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/browse" className="btn-accent">
              <BookOpen size={16} aria-hidden="true" />
              Browse Now
            </Link>
            <Link href="/originals" className="btn-ghost">
              Originals
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Continue Reading — populated dynamically in a future session */}
      <section
        className="max-w-screen-xl mx-auto px-4"
        aria-labelledby="continue-reading-heading"
      >
        <div className="flex items-center gap-2 mb-6">
          <BookOpen size={18} className="text-text-secondary" aria-hidden="true" />
          <h2 id="continue-reading-heading" className="section-heading">Continue Reading</h2>
        </div>
        <p className="text-text-muted text-sm">
          Sign in to see your reading history here.
        </p>
      </section>

      {/* Trending Now */}
      <section
        className="max-w-screen-xl mx-auto px-4"
        aria-labelledby="trending-heading"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="trending-heading" className="section-heading">Trending Now</h2>
          <Link
            href="/browse"
            className="text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label="View all trending content in browse page"
          >
            VIEW BROWSE <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" role="list">
          {/* Cards loaded via client component in a future session */}
          <p className="col-span-full text-text-muted text-sm">Loading trending content…</p>
        </div>
      </section>

      {/* Originals promo */}
      <section
        className="max-w-screen-xl mx-auto px-4 mb-16"
        aria-labelledby="originals-heading"
      >
        <div className="card-elevated p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tv2 size={20} className="text-accent" aria-hidden="true" />
              <h2 id="originals-heading" className="text-lg font-bold text-text">Toonflow Originals</h2>
            </div>
            <p className="text-text-secondary max-w-sm">
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
