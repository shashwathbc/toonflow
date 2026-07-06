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
//
// The purple accent (#8B5CF6 = Tailwind violet-500) is intentionally distinct
// from the app tokens — it lives in arbitrary-value classes, not inline styles.

interface CreditsPosterProps {
  novel: Novel
  chapterNumber: number
}

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
      <span className="relative min-w-0 -skew-x-12 bg-white text-black font-black text-[11px] sm:text-sm tracking-wide px-3 py-1 shadow-[0_0_12px_rgba(139,92,246,0.5)] [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)]">
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
        <div className="absolute -top-1/4 -left-1/4 w-[70%] h-[90%] bg-[radial-gradient(circle,#8B5CF633_0%,transparent_60%)]" />
        <div className="absolute top-1/4 right-0 w-[55%] h-[80%] bg-[radial-gradient(circle,#8B5CF62b_0%,transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[image:linear-gradient(#8B5CF655_1px,transparent_1px),linear-gradient(90deg,#8B5CF655_1px,transparent_1px)] bg-[length:46px_46px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,black_30%,transparent_85%)]" />
        <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(115deg,transparent_0_42px,#8B5CF60f_42px_43px)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_45%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* ── Poster banner ── */}
      <div className="relative z-10 mx-auto w-full max-w-5xl flex flex-col md:flex-row items-center gap-6 md:gap-8 animate-[reader-fade-in_0.9s_both]">
        {/* Left — framed cover with watermark + brand links */}
        <div className="w-56 sm:w-64 md:w-[40%] max-w-[340px] flex flex-col gap-3">
          <div className="relative aspect-[4/3] w-full drop-shadow-[0_0_24px_#8B5CF666]">
            <div className="absolute inset-0 p-[3px] [clip-path:polygon(0_10%,6%_0,94%_0,100%_10%,100%_90%,94%_100%,6%_100%,0_90%)] bg-[linear-gradient(135deg,#8B5CF6,#4C1D95_55%,#8B5CF6)]">
              <div className="relative w-full h-full overflow-hidden bg-black [clip-path:polygon(0_10%,6%_0,94%_0,100%_10%,100%_90%,94%_100%,6%_100%,0_90%)]">
                {novel.coverURL ? (
                  <Image src={novel.coverURL} alt={novel.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-black">
                    <BookOpen size={40} className="text-white/20" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                <span className="absolute inset-x-0 bottom-3 text-center text-white/90 font-black tracking-[0.15em] text-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  TOONFLOW <span className="text-violet-300">STUDIO&nbsp;PAINT</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <AtSign size={14} className="text-violet-500" aria-hidden="true" />
              {handle}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <Globe size={14} className="text-violet-500" aria-hidden="true" />
              {site}
            </span>
          </div>
        </div>

        {/* Right — chapter medallion, title banner, credits */}
        <div className="w-full md:w-[60%] flex flex-col justify-center gap-5">
          <div className="flex justify-end">
            <div
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(20,10,40,0.9),#000)] shadow-[0_0_0_2px_#8B5CF6,0_0_30px_#8B5CF688,inset_0_0_20px_#8B5CF655]"
              aria-label={`Chapter ${chapterNumber}`}
            >
              <span className="text-4xl sm:text-5xl font-black text-white italic [font-family:Georgia,serif] [text-shadow:0_0_18px_#8B5CF6]">
                {chapterNumber}
              </span>
            </div>
          </div>

          <div className="relative bg-white px-6 py-3 -skew-x-6 shadow-[0_0_30px_rgba(139,92,246,0.55)] [clip-path:polygon(2%_0,100%_6%,98%_100%,0_88%)]">
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
        <ChevronDown size={16} className="animate-bounce text-violet-500" />
      </div>
    </section>
  )
}
