'use client'

import Link from 'next/link'
import { PenLine, BookOpen, ArrowLeft } from 'lucide-react'
import type { Novel } from '@/types'

// Ending / outro credits page — the closing "page" after the last chapter.
// Mirrors the scanlation-style ending card (misty hero, title logo, production
// credits, studio mark, copyright line) but branded Toonflow and data-driven,
// staying visually cohesive with the intro CreditsPoster (purple accent,
// #8B5CF6 = Tailwind violet-500, kept in arbitrary-value classes).

// Per-particle placement/timing as literal Tailwind classes (position, base
// opacity, and the --p-* vars the shared animate-[…] class + the
// reader-particle-float keyframes consume). Literal strings so the JIT sees
// them — values match the old `(i * k + c) % m` generation formulas.
const PARTICLES = [
  'left-[17%] top-[11%] opacity-[0.12] [--p-opacity:0.12] [--p-dur:6.0s] [--p-delay:0.0s]',
  'left-[60%] top-[70%] opacity-[0.29] [--p-opacity:0.29] [--p-dur:8.7s] [--p-delay:1.9s]',
  'left-[6%] top-[36%] opacity-[0.46] [--p-opacity:0.46] [--p-dur:6.4s] [--p-delay:3.8s]',
  'left-[49%] top-[2%] opacity-[0.23] [--p-opacity:0.23] [--p-dur:9.1s] [--p-delay:5.7s]',
  'left-[92%] top-[61%] opacity-[0.4] [--p-opacity:0.4] [--p-dur:6.8s] [--p-delay:0.6s]',
  'left-[38%] top-[27%] opacity-[0.17] [--p-opacity:0.17] [--p-dur:9.5s] [--p-delay:2.5s]',
  'left-[81%] top-[86%] opacity-[0.34] [--p-opacity:0.34] [--p-dur:7.2s] [--p-delay:4.4s]',
  'left-[27%] top-[52%] opacity-[0.51] [--p-opacity:0.51] [--p-dur:9.9s] [--p-delay:6.3s]',
  'left-[70%] top-[18%] opacity-[0.28] [--p-opacity:0.28] [--p-dur:7.6s] [--p-delay:1.2s]',
  'left-[16%] top-[77%] opacity-[0.45] [--p-opacity:0.45] [--p-dur:10.3s] [--p-delay:3.1s]',
  'left-[59%] top-[43%] opacity-[0.22] [--p-opacity:0.22] [--p-dur:8.0s] [--p-delay:5.0s]',
  'left-[5%] top-[9%] opacity-[0.39] [--p-opacity:0.39] [--p-dur:10.7s] [--p-delay:6.9s]',
  'left-[48%] top-[68%] opacity-[0.16] [--p-opacity:0.16] [--p-dur:8.4s] [--p-delay:1.8s]',
  'left-[91%] top-[34%] opacity-[0.33] [--p-opacity:0.33] [--p-dur:6.1s] [--p-delay:3.7s]',
  'left-[37%] top-[0%] opacity-[0.5] [--p-opacity:0.5] [--p-dur:8.8s] [--p-delay:5.6s]',
  'left-[80%] top-[59%] opacity-[0.27] [--p-opacity:0.27] [--p-dur:6.5s] [--p-delay:0.5s]',
  'left-[26%] top-[25%] opacity-[0.44] [--p-opacity:0.44] [--p-dur:9.2s] [--p-delay:2.4s]',
  'left-[69%] top-[84%] opacity-[0.21] [--p-opacity:0.21] [--p-dur:6.9s] [--p-delay:4.3s]',
  'left-[15%] top-[50%] opacity-[0.38] [--p-opacity:0.38] [--p-dur:9.6s] [--p-delay:6.2s]',
  'left-[58%] top-[16%] opacity-[0.15] [--p-opacity:0.15] [--p-dur:7.3s] [--p-delay:1.1s]',
]

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
          key={p}
          className={`absolute w-[3px] h-[3px] rounded-full bg-violet-300 pointer-events-none will-change-transform animate-[reader-particle-float_var(--p-dur)_ease-in-out_var(--p-delay)_infinite] ${p}`}
          aria-hidden="true"
        />
      ))}

      {/* Misty purple veils */}
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,#8B5CF622_0%,transparent_65%)]" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,rgba(255,255,255,0.03)_0%,transparent_70%)]" aria-hidden="true" />

      <div className="relative z-10 text-center px-2 max-w-xl mx-auto flex flex-col items-center gap-9 animate-[reader-fade-in_1s_both]">
        {/* Fin divider */}
        <div className="flex items-center justify-center gap-5">
          <div className="h-px w-16 bg-[linear-gradient(to_right,transparent,#8B5CF688)]" />
          <span className="text-[9px] tracking-[0.6em] uppercase text-violet-500">The End</span>
          <div className="h-px w-16 bg-[linear-gradient(to_left,transparent,#8B5CF688)]" />
        </div>

        {/* Title logo — the story's mark, centered and dramatic */}
        <div className="space-y-3">
          <h2 className="font-black text-white leading-[1.05] text-[length:clamp(2.4rem,8vw,4.5rem)] [font-family:Georgia,'Times_New_Roman',serif] [text-shadow:0_0_40px_#8B5CF655,0_2px_6px_rgba(0,0,0,0.8)]">
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
            <span className="text-violet-300">STUDIO&nbsp;PAINT</span>
          </p>
          <div className="h-px w-24 bg-[linear-gradient(to_right,transparent,#8B5CF6,transparent)]" />
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
