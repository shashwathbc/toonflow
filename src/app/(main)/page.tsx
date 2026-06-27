import type { Metadata } from 'next'
import { BookOpen, Tv2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { HomeFeed } from './HomeFeed'

export const metadata: Metadata = {
  title: 'Home — Toonflow Studio Paint',
  description: 'Read the latest webtoons, manga, and novels from creators around the world.',
}

export default function HomePage() {
  return (
    <div className="space-y-0">
      {/* Hero */}
      <section
        className="relative min-h-[420px] bg-bg-elevated flex items-end"
        aria-label="Featured content"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent pointer-events-none" />
        <div className="relative max-w-screen-xl mx-auto px-4 pb-12 space-y-4 w-full">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/50 tracking-widest uppercase bg-bg-elevated border border-bg-border rounded-full px-3 py-1">
              ✦ Trending Now
            </span>
          </div>
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
            <Link href="/originals" className="btn-ghost">
              Originals
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Dynamic feed — loads trending content from Firestore */}
      <HomeFeed />

      {/* Originals promo */}
      <section
        className="max-w-screen-xl mx-auto px-4 pb-16"
        aria-labelledby="originals-promo-heading"
      >
        <div className="bg-bg-elevated border border-bg-border p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tv2 size={20} className="text-accent" aria-hidden="true" />
              <h2 id="originals-promo-heading" className="text-lg font-bold text-white">Toonflow Originals</h2>
            </div>
            <p className="text-white/60 max-w-sm">
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
