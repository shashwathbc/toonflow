'use client'

import Image from 'next/image'
import { Globe, AtSign, BookOpen, ChevronDown } from 'lucide-react'
import type { Novel } from '@/types'

// Modern webtoon-style title splash — the first "page" a reader sees on
// chapter 1. Cover-forward and centered, the way series landing pages read on
// Webtoon / Tapas: a rounded cover, genre pills, a bold title, quiet metadata
// rows and a subtle brand footer. Branded for Toonflow Studio Paint and driven
// by the novel's real data.
//
// It is a self-contained banner that sits right below the reader header, so the
// whole splash is visible on load and the chapter content flows beneath it.
//
// Palette: ambiance comes from the novel's own cover art (blurred + vignetted),
// the single accent is the app brand token (accent = #00C896), used sparingly.

interface CreditsPosterProps {
  novel: Novel
  chapterNumber: number
}

function Dot() {
  return <span className="w-1 h-1 rounded-full bg-white/25" aria-hidden="true" />
}

export function CreditsPoster({ novel, chapterNumber }: CreditsPosterProps) {
  const site = 'toonflowstudiopaint.com'
  const handle = '@toonflowstudiopaint'
  const genres = novel.genres?.slice(0, 3) ?? []

  return (
    <section
      className="relative w-full overflow-hidden bg-black px-5 pt-16 pb-12 select-none"
      aria-label="Title page"
    >
      {/* ── Ambient background — driven by the cover art, not synthetic glow ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {novel.coverURL && (
          <div className="absolute inset-0 opacity-30 scale-110">
            <Image src={novel.coverURL} alt="" fill className="object-cover blur-3xl" aria-hidden="true" />
          </div>
        )}
        {/* Cinematic vignette keeps the splash legible over any cover */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_40%,transparent_35%,rgba(0,0,0,0.9)_100%)]" />
      </div>

      {/* ── Centered splash ── */}
      <div className="relative z-10 mx-auto w-full max-w-md flex flex-col items-center text-center gap-6 animate-[reader-fade-in_0.9s_both]">
        {/* Cover */}
        <div className="relative w-52 sm:w-60 aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
          {novel.coverURL ? (
            <Image src={novel.coverURL} alt={novel.title} fill className="object-cover" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
              <BookOpen size={40} className="text-white/20" aria-hidden="true" />
            </div>
          )}
          {/* Brand watermark on a soft gradient */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
          <span className="absolute inset-x-0 bottom-3 text-center text-[11px] font-bold tracking-[0.2em] text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            TOONFLOW <span className="text-accent">STUDIO&nbsp;PAINT</span>
          </span>
        </div>

        {/* Genre pills */}
        {genres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {genres.map((g) => (
              <span
                key={g}
                className="text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full border border-white/15 text-white/65"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-[length:clamp(2.25rem,9vw,3.75rem)] font-black uppercase text-white leading-[1.02] tracking-tight [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
          {novel.title || 'Untitled'}
        </h1>

        {/* Author */}
        <p className="text-sm text-white/50 -mt-1">
          by <span className="text-white/85 font-semibold">{novel.authorName}</span>
        </p>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-white/45">
          <span className="capitalize">{novel.status}</span>
          <Dot />
          <span>{novel.chapterCount || 1} chapters</span>
          <Dot />
          <span>{(novel.language || 'EN').toUpperCase()}</span>
        </div>

        {/* Chapter marker */}
        <div className="flex items-center gap-3 mt-1">
          <span className="h-px w-8 bg-white/15" aria-hidden="true" />
          <span className="text-[11px] font-bold tracking-[0.35em] text-accent uppercase">
            Chapter {chapterNumber}
          </span>
          <span className="h-px w-8 bg-white/15" aria-hidden="true" />
        </div>

        {/* Brand footer */}
        <div className="flex flex-col items-center gap-1.5 mt-1 text-[13px] text-white/45">
          <span className="flex items-center gap-2">
            <AtSign size={13} className="text-accent" aria-hidden="true" />
            {handle}
          </span>
          <span className="flex items-center gap-2">
            <Globe size={13} className="text-accent" aria-hidden="true" />
            {site}
          </span>
        </div>

        {/* Scroll cue */}
        <div className="mt-4 flex flex-col items-center gap-1.5" aria-hidden="true">
          <p className="text-[9px] tracking-[0.5em] text-white/30 uppercase">Scroll to Begin</p>
          <ChevronDown size={16} className="animate-bounce text-white/40" />
        </div>
      </div>
    </section>
  )
}
