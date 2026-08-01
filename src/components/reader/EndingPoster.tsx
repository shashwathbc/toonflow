'use client'

import Link from 'next/link'
import { Heart, MessageCircle, Star, Share2, UserPlus } from 'lucide-react'
import { APP_URL } from '@/lib/utils/constants'
import type { Novel, Chapter } from '@/types'

const SITE_HOST = APP_URL.includes('localhost') ? 'TOONFLOWSTUDIOPAINT.COM' : APP_URL.replace(/^https?:\/\//, '')

const ENGAGEMENT_CUES = [
  { icon: Heart, label: 'Like' },
  { icon: MessageCircle, label: 'Comment' },
  { icon: Star, label: 'Subscribe' },
  { icon: Share2, label: 'Share' },
] as const

interface EndingPosterProps {
  novel: Novel
  chapter?: Chapter // Make it optional for backwards compatibility
  // Author's current profile display name; overrides the (possibly stale)
  // authorName denormalized on the novel doc for the follow label.
  authorNameOverride?: string
}

export function EndingPoster({ novel, chapter, authorNameOverride }: EndingPosterProps) {
  const message = 'Thank You for Reading'
  const teaser = 'Next chapter coming soon'
  const year = new Date().getFullYear()
  const authorDisplay = authorNameOverride || novel.authorName

  return (
    <section
      className="relative w-full overflow-hidden bg-black select-none"
      aria-label={`${novel.title} — Chapter ${chapter?.chapterNumber ?? ''} closing page`}
    >
      {/* Ambient stage glows */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none bg-[radial-gradient(ellipse_90%_100%_at_50%_100%,rgba(255,255,255,0.04)_0%,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-3/4 aspect-square rounded-full pointer-events-none bg-accent/[0.05] blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-7 px-6 py-14 text-center">
        {/* End divider */}
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-white/60" />
          <p className="text-[9px] tracking-[0.6em] uppercase text-white font-semibold">
            {chapter ? `End of Chapter ${chapter.chapterNumber}` : 'The End'}
          </p>
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-white/60" />
        </div>

        {/* Farewell headline */}
        <h2 className="font-black text-white leading-[1.1] text-[length:clamp(1.7rem,5.5vw,3rem)] [font-family:Georgia,'Times_New_Roman',serif] [text-shadow:0_0_40px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.8)]">
          {message}
        </h2>

        {/* Teaser */}
        <p className="text-sm font-light italic text-white/55 [font-family:Georgia,serif]">{teaser}</p>

        {/* Engagement cues */}
        <ul className="flex flex-wrap items-center justify-center gap-2.5" aria-label="Ways to support this series">
          {ENGAGEMENT_CUES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-white/60 hover:bg-white/10 cursor-pointer transition-colors"
            >
              <Icon size={12} className="text-white/80" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        {/* Follow the creator */}
        <div className="flex flex-col items-center gap-1.5">
          <Link
            href={`/profile/${novel.authorId}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <UserPlus size={16} aria-hidden="true" />
            Follow {authorDisplay}
          </Link>
        </div>

        {/* Studio mark */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <p className="font-black tracking-[0.15em] text-base">
            <span className="text-white">TOONFLOW STUDIO&nbsp;PAINT</span>
          </p>
          <span aria-hidden="true" className="h-px w-24 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <p className="text-[10px] tracking-[0.25em] text-white/30 uppercase">{SITE_HOST}</p>
        </div>

        {/* Copyright footer */}
        <p className="text-[9px] text-white/25 tracking-wider">
          © {year} {authorDisplay} · All rights reserved · Published on Toonflow Studio Paint
        </p>
      </div>
    </section>
  )
}
