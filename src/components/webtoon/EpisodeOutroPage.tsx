import Link from 'next/link'
import { Heart, MessageCircle, Star, Share2, UserPlus } from 'lucide-react'
import { APP_URL } from '@/lib/utils/constants'
import type { Webtoon, Episode } from '@/types'

// Mandatory branded closing page of every episode — the structural twin of
// EpisodeIntroPage, rendered after the panel strip in editor and reader so it
// can never be deleted or reordered away. Text overrides live in
// episode.outro (EpisodeOutroMeta); everything else derives from the series.
// `interactive` disables the follow link inside the editor preview.

const SITE_HOST = APP_URL.replace(/^https?:\/\//, '')

const ENGAGEMENT_CUES = [
  { icon: Heart, label: 'Like' },
  { icon: MessageCircle, label: 'Comment' },
  { icon: Star, label: 'Subscribe' },
  { icon: Share2, label: 'Share' },
] as const

interface EpisodeOutroPageProps {
  webtoon: Webtoon
  episode: Episode
  interactive?: boolean
}

export function EpisodeOutroPage({ webtoon, episode, interactive = true }: EpisodeOutroPageProps) {
  const meta = episode.outro ?? {}
  const message = meta.message?.trim() || 'Thank You for Reading'
  const teaser = meta.teaser?.trim() || 'Next episode coming soon'
  const handle = meta.handle?.trim()
  const year = new Date().getFullYear()

  return (
    <section
      className="relative w-full overflow-hidden bg-black select-none"
      aria-label={`${webtoon.title} — Episode ${episode.episodeNumber} closing page`}
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
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-accent/60" />
          <p className="text-[9px] tracking-[0.6em] uppercase text-accent font-semibold">
            End of Episode {episode.episodeNumber}
          </p>
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-accent/60" />
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-white/60"
            >
              <Icon size={12} className="text-accent" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        {/* Follow the creator */}
        <div className="flex flex-col items-center gap-1.5">
          {interactive ? (
            <Link
              href={`/profile/${webtoon.authorId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent text-accent-foreground font-bold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <UserPlus size={14} aria-hidden="true" />
              Follow {webtoon.authorName}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent text-accent-foreground font-bold text-sm">
              <UserPlus size={14} aria-hidden="true" />
              Follow {webtoon.authorName}
            </span>
          )}
          {handle && <p className="text-[11px] text-white/40">{handle}</p>}
        </div>

        {/* Studio mark */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <p className="font-black tracking-[0.15em] text-base">
            <span className="text-white">TOONFLOW</span>{' '}
            <span className="text-accent">STUDIO&nbsp;PAINT</span>
          </p>
          <span aria-hidden="true" className="h-px w-24 bg-gradient-to-r from-transparent via-accent to-transparent" />
          <p className="text-[10px] tracking-[0.25em] text-white/30 uppercase">{SITE_HOST}</p>
        </div>

        {/* Copyright footer */}
        <p className="text-[9px] text-white/25 tracking-wider">
          © {year} {webtoon.authorName} · All rights reserved · Published on Toonflow Studio Paint
        </p>
      </div>
    </section>
  )
}
