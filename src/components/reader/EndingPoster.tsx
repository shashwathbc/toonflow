'use client'

import Link from 'next/link'
import { PenLine, BookOpen, ArrowLeft } from 'lucide-react'
import type { Novel } from '@/types'

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

export function EndingPoster({ novel }: EndingPosterProps) {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden"
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
            background:      'white',
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

      {/* Gradient overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)' }} aria-hidden="true" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none" aria-hidden="true" />

      <div
        className="relative z-10 text-center px-6 max-w-xl mx-auto space-y-10"
        style={{ animationName: 'reader-fade-in', animationDuration: '1s', animationFillMode: 'both' }}
      >
        {/* Fin divider */}
        <div className="flex items-center justify-center gap-5">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/20" />
          <span className="text-[9px] tracking-[0.6em] text-white/20 uppercase">The End</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/20" />
        </div>

        {/* Thank you */}
        <div className="space-y-3">
          <h2
            className="font-black text-white leading-tight"
            style={{ fontSize: 'clamp(2rem, 7vw, 4rem)', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Thank You<br />For Reading
          </h2>
          <p className="text-lg text-white/40 font-light">{novel.title}</p>
        </div>

        {/* Creator pitch */}
        <div className="py-2 space-y-3">
          <p className="text-xl sm:text-2xl font-bold text-white">Your Story Could Be Next.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-white/30">
            {['Create', 'Publish', 'Earn'].map((word, i) => (
              <span key={word} className="flex items-center gap-2">
                <span className="font-semibold text-white/50">{word}</span>
                {i < 2 && <span className="text-white/15">·</span>}
              </span>
            ))}
          </div>
          <p className="text-sm text-white/25 leading-relaxed">
            Write novels. Draw webtoons.<br />Build your audience.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
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
        <div>
          <Link
            href={`/novel/${novel.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none rounded"
          >
            <ArrowLeft size={11} aria-hidden="true" />
            Back to {novel.title}
          </Link>
        </div>

        {/* Brand */}
        <p className="text-[9px] tracking-[0.6em] text-white/15 uppercase pt-4">
          Toonflow Studio Paint
        </p>
      </div>
    </section>
  )
}
