'use client'

import Image from 'next/image'
import { Globe, AtSign, BookOpen, ChevronDown } from 'lucide-react'
import type { Novel } from '@/types'

// Scanlation-style title / credits splash — the first "page" a reader sees on
// chapter 1. Recreates the AsuraScans-style hero (framed cover art + watermark,
// slashed title banner, chapter medallion, credits grid) but branded for
// Toonflow Studio Paint and driven by the novel's real data.
//
// It is a self-contained banner that sits right below the reader header (not a
// full-screen centered hero), so the entire poster is always visible on load —
// the chapter's cover reveal + content flow beneath it.

interface CreditsPosterProps {
  novel: Novel
  chapterNumber: number
}

const ACCENT = '#8B5CF6'

// One credit cell — a skewed white slab with a dark role tab, exactly like the
// reference's "TL · SHOUNEN" chips.
function Credit({ role, value }: { role: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="flex-shrink-0 text-[10px] sm:text-xs font-black tracking-wider text-white/80 -skew-x-12 px-1"
        aria-hidden="true"
      >
        {role}
      </span>
      <span
        className="relative min-w-0 -skew-x-12 bg-white text-black font-black text-[11px] sm:text-sm tracking-wide px-3 py-1 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
        style={{ clipPath: 'polygon(6% 0, 100% 0, 94% 100%, 0 100%)' }}
      >
        <span className="block skew-x-12 truncate uppercase">{value || '—'}</span>
      </span>
    </div>
  )
}

export function CreditsPoster({ novel, chapterNumber }: CreditsPosterProps) {
  const site = 'toonflowstudiopaint.com'
  const handle = '@toonflowstudiopaint'

  const credits: { role: string; value: string }[] = [
    { role: 'AUTHOR', value: novel.authorName },
    { role: 'STUDIO', value: 'TOONFLOW' },
    { role: 'GENRE', value: novel.genres?.[0] ?? 'STORY' },
    { role: 'STATUS', value: novel.status },
    { role: 'CHAPTERS', value: String(novel.chapterCount || 1) },
    { role: 'LANG', value: (novel.language || 'EN').toUpperCase() },
  ]

  return (
    <section
      className="relative w-full overflow-hidden bg-black px-4 pt-16 pb-8 select-none"
      aria-label="Title page"
    >
      {/* ── Ambient energy background ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {novel.coverURL && (
          <div className="absolute inset-0 opacity-20 scale-110">
            <Image src={novel.coverURL} alt="" fill className="object-cover blur-3xl" aria-hidden="true" />
          </div>
        )}
        <div
          className="absolute -top-1/4 -left-1/4 w-[70%] h-[90%]"
          style={{ background: `radial-gradient(circle, ${ACCENT}33 0%, transparent 60%)` }}
        />
        <div
          className="absolute top-1/4 right-0 w-[55%] h-[80%]"
          style={{ background: `radial-gradient(circle, ${ACCENT}2b 0%, transparent 60%)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(${ACCENT}55 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}55 1px, transparent 1px)`,
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 85%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: `repeating-linear-gradient(115deg, transparent 0 42px, ${ACCENT}0f 42px 43px)` }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 45%, rgba(0,0,0,0.8) 100%)' }} />
      </div>

      {/* ── Poster banner ── */}
      <div
        className="relative z-10 mx-auto w-full max-w-5xl flex flex-col md:flex-row items-center gap-6 md:gap-8"
        style={{ animationName: 'reader-fade-in', animationDuration: '0.9s', animationFillMode: 'both' }}
      >
        {/* Left — framed cover with watermark + brand links */}
        <div className="w-56 sm:w-64 md:w-[40%] max-w-[340px] flex flex-col gap-3">
          <div
            className="relative aspect-[4/3] w-full"
            style={{ filter: `drop-shadow(0 0 24px ${ACCENT}66)` }}
          >
            <div
              className="absolute inset-0 p-[3px]"
              style={{
                clipPath: 'polygon(0 10%, 6% 0, 94% 0, 100% 10%, 100% 90%, 94% 100%, 6% 100%, 0 90%)',
                background: `linear-gradient(135deg, ${ACCENT}, #4C1D95 55%, ${ACCENT})`,
              }}
            >
              <div
                className="relative w-full h-full overflow-hidden bg-black"
                style={{ clipPath: 'polygon(0 10%, 6% 0, 94% 0, 100% 10%, 100% 90%, 94% 100%, 6% 100%, 0 90%)' }}
              >
                {novel.coverURL ? (
                  <Image src={novel.coverURL} alt={novel.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-black">
                    <BookOpen size={40} className="text-white/20" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                <span className="absolute inset-x-0 bottom-3 text-center text-white/90 font-black tracking-[0.15em] text-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  TOONFLOW <span style={{ color: '#C4B5FD' }}>STUDIO&nbsp;PAINT</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <AtSign size={14} style={{ color: ACCENT }} aria-hidden="true" />
              {handle}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <Globe size={14} style={{ color: ACCENT }} aria-hidden="true" />
              {site}
            </span>
          </div>
        </div>

        {/* Right — chapter medallion, title banner, credits */}
        <div className="w-full md:w-[60%] flex flex-col justify-center gap-5">
          <div className="flex justify-end">
            <div
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(20,10,40,0.9), #000)',
                boxShadow: `0 0 0 2px ${ACCENT}, 0 0 30px ${ACCENT}88, inset 0 0 20px ${ACCENT}55`,
              }}
              aria-label={`Chapter ${chapterNumber}`}
            >
              <span
                className="text-4xl sm:text-5xl font-black text-white italic"
                style={{ fontFamily: 'Georgia, serif', textShadow: `0 0 18px ${ACCENT}` }}
              >
                {chapterNumber}
              </span>
            </div>
          </div>

          <div
            className="relative bg-white px-6 py-3 -skew-x-6 shadow-[0_0_30px_rgba(139,92,246,0.55)]"
            style={{ clipPath: 'polygon(2% 0, 100% 6%, 98% 100%, 0 88%)' }}
          >
            <h1 className="skew-x-6 text-black font-black uppercase tracking-tight leading-none text-2xl sm:text-4xl">
              {novel.title || 'Untitled'}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
            {credits.map((c) => (
              <Credit key={c.role} role={c.role} value={c.value} />
            ))}
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="relative z-10 mt-8 flex flex-col items-center gap-1.5" aria-hidden="true">
        <p className="text-[9px] tracking-[0.5em] text-white/30 uppercase">Scroll to Begin</p>
        <ChevronDown
          size={16}
          style={{ color: ACCENT }}
          className="animate-bounce"
        />
      </div>
    </section>
  )
}
