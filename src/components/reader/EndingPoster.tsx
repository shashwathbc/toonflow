'use client'

import Link from 'next/link'
import { PenLine, BookOpen, ArrowLeft } from 'lucide-react'
import type { Novel } from '@/types'

// Ending / outro credits page — the closing "page" after the last chapter.
// Mirrors the scanlation-style ending card (misty hero, title logo, production
// credits, studio mark, copyright line) but branded Toonflow and data-driven,
// staying visually cohesive with the intro CreditsPoster (purple accent).

const ACCENT = '#8B5CF6'

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left:     `${(i * 43 + 17) % 97}%`,
  top:      `${(i * 59 + 11) % 93}%`,
  size:      ((i * 3 + 2) % 3) + 1,
  delay:    `${((i * 1.9)  % 7).toFixed(1)}s`,
  duration: `${(((i * 2.7) % 5) + 6).toFixed(1)}s`,
  opacity:   (((i * 17) % 40) + 12) / 100,
}))

interface EndingPosterProps {
  novel: Novel
}

// Production-credit line — "ROLE  ·  value", like the ending card's staff list.
function CreditLine({ role, value }: { role: string; value: string }) {
  return (
    <p className="text-sm text-white/45">
      <span className="tracking-[0.3em] text-white/30 uppercase text-[11px] mr-2">{role}</span>
      <span className="font-semibold text-white/70">{value}</span>
    </p>
  )
}

export function EndingPoster({ novel }: EndingPosterProps) {
  const year = new Date().getFullYear()
  const genre = novel.genres?.[0] ? novel.genres[0].replace(/\b\w/g, (c) => c.toUpperCase()) : 'Story'

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden px-4 py-20"
      aria-label="Story ending"
    >
      {/* Particles */}
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full pointer-events-none will-change-transform"
          style={{
            left:            p.left,
            top:             p.top,
            width:           p.size,
            height:          p.size,
            background:      '#C4B5FD',
            ['--p-opacity' as string]: p.opacity,
            opacity:         p.opacity,
            animationName:        'reader-particle-float',
            animationDuration:    p.duration,
            animationDelay:       p.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
          aria-hidden="true"
        />
      ))}

      {/* Misty purple veils */}
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${ACCENT}22 0%, transparent 65%)` }} aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.03) 0%, transparent 70%)' }} aria-hidden="true" />

      <div
        className="relative z-10 text-center px-2 max-w-xl mx-auto flex flex-col items-center gap-9"
        style={{ animationName: 'reader-fade-in', animationDuration: '1s', animationFillMode: 'both' }}
      >
        {/* Fin divider */}
        <div className="flex items-center justify-center gap-5">
          <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${ACCENT}88)` }} />
          <span className="text-[9px] tracking-[0.6em] uppercase" style={{ color: `${ACCENT}` }}>The End</span>
          <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${ACCENT}88)` }} />
        </div>

        {/* Title logo — the story's mark, centered and dramatic */}
        <div className="space-y-3">
          <h2
            className="font-black text-white leading-[1.05]"
            style={{
              fontSize: 'clamp(2.4rem, 8vw, 4.5rem)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: `0 0 40px ${ACCENT}55, 0 2px 6px rgba(0,0,0,0.8)`,
            }}
          >
            {novel.title || 'Untitled'}
          </h2>
          <p className="text-[10px] tracking-[0.45em] text-white/35 uppercase">
            {genre} · {novel.status}
          </p>
        </div>

        {/* Production credits */}
        <div className="space-y-2 pt-1">
          <CreditLine role="Written by" value={novel.authorName} />
          <CreditLine role="Genre" value={genre} />
          <CreditLine role="Chapters" value={String(novel.chapterCount || 1)} />
          <CreditLine role="Language" value={(novel.language || 'EN').toUpperCase()} />
        </div>

        {/* Studio mark — like the ending card's publisher logo */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <p className="font-black tracking-[0.15em] text-lg">
            <span className="text-white">TOONFLOW</span>{' '}
            <span style={{ color: '#C4B5FD' }}>STUDIO&nbsp;PAINT</span>
          </p>
          <div className="h-px w-24" style={{ background: `linear-gradient(to right, transparent, ${ACCENT}, transparent)` }} />
        </div>

        {/* Creator CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/create/novel"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <PenLine size={14} aria-hidden="true" />
            Start Creating
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-white/15 text-white/60 text-sm font-medium hover:text-white hover:border-white/30 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <BookOpen size={14} aria-hidden="true" />
            Discover More
          </Link>
        </div>

        {/* Back link */}
        <Link
          href={`/novel/${novel.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded"
        >
          <ArrowLeft size={11} aria-hidden="true" />
          Back to {novel.title}
        </Link>

        {/* Copyright notice */}
        <p className="text-[10px] leading-relaxed text-white/20 max-w-sm pt-2">
          © {year} {novel.authorName} · Toonflow Studio Paint.<br />
          This work is protected by copyright. Unauthorized reproduction or
          distribution is prohibited.
        </p>
      </div>
    </section>
  )
}
