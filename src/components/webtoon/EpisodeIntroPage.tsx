import Image from 'next/image'
import type { Webtoon, Episode } from '@/types'

// Mandatory branded opening page of every episode. Rendered structurally
// before the panel strip in both the editor and the reader — it is not a
// panel, so no panel operation (delete / move / duplicate) can ever remove
// it. All artwork and identity come live from the series document; the only
// per-episode overrides are the small text fields in episode.intro
// (EpisodeIntroMeta). Visual language mirrors the novel reader's IntroPoster:
// black stage, serif display title, wide-tracked uppercase eyebrows.

interface EpisodeIntroPageProps {
  webtoon: Webtoon
  episode: Episode
}

export function EpisodeIntroPage({ webtoon, episode }: EpisodeIntroPageProps) {
  const meta = episode.intro ?? {}
  const synopsis = webtoon.synopsis ?? ''
  const tagline = (meta.tagline?.trim() || synopsis.split(/[.!?]/)[0]?.trim() || '').slice(0, 140)
  const creditLine = meta.creditLine?.trim() || webtoon.authorName
  const genre = webtoon.genres?.[0]
  const episodeNo = String(episode.episodeNumber ?? 1).padStart(2, '0')

  return (
    <section
      className="relative w-full overflow-hidden bg-black select-none"
      aria-label={`${webtoon.title} — Episode ${episode.episodeNumber} title page`}
    >
      {/* Ambient stage glows */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-2/3 pointer-events-none bg-[radial-gradient(ellipse_90%_100%_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-3/4 aspect-square rounded-full pointer-events-none bg-accent/[0.06] blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-7 px-6 py-14 text-center">
        {/* Studio eyebrow */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl border border-accent/30 bg-accent/10 flex items-center justify-center">
            <span className="text-accent font-black text-[11px] tracking-widest">TF</span>
          </div>
          <p className="text-[9px] font-bold tracking-[0.45em] text-white/35 uppercase">
            Toonflow Studio Paint Presents
          </p>
        </div>

        {/* Framed cover artwork */}
        {webtoon.coverURL && (
          <div className="relative w-2/3 max-w-[260px] rounded-lg border border-accent/25 p-1.5 bg-white/[0.03] shadow-[0_0_50px_-12px] shadow-accent/40">
            <div className="relative aspect-[2/3] overflow-hidden rounded-md">
              <Image
                src={webtoon.coverURL}
                alt={`Cover artwork of ${webtoon.title}`}
                fill
                className="object-cover"
                sizes="260px"
              />
            </div>
            {/* Corner ticks, scanlation-frame style */}
            <span aria-hidden="true" className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-accent rounded-tl-lg" />
            <span aria-hidden="true" className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-accent rounded-br-lg" />
          </div>
        )}

        {/* Episode marker */}
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-transparent to-accent/60" />
          <p className="text-[10px] tracking-[0.5em] uppercase text-accent font-semibold">
            Episode {episodeNo}
          </p>
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-l from-transparent to-accent/60" />
        </div>

        {/* Series title */}
        <h2 className="font-black text-white leading-[1.05] text-[length:clamp(1.9rem,6vw,3.6rem)] tracking-[-0.02em] [font-family:Georgia,'Times_New_Roman',serif] [text-shadow:0_0_50px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.8)]">
          {webtoon.title || 'Untitled'}
        </h2>

        {/* Episode title */}
        {episode.title && (
          <p className="text-sm font-semibold text-white/70 -mt-3">{episode.title}</p>
        )}

        {/* Tagline */}
        {tagline.length > 8 && (
          <p className="text-base sm:text-lg font-light italic leading-relaxed text-accent/90 max-w-md [font-family:Georgia,serif]">
            &ldquo;{tagline}&rdquo;
          </p>
        )}

        {/* Credits */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-white/45">
            <span className="tracking-[0.3em] text-white/30 uppercase text-[10px] mr-2">Story &amp; Art</span>
            <span className="font-semibold text-white/75">{creditLine}</span>
          </p>
          {genre && (
            <p className="text-xs text-white/45">
              <span className="tracking-[0.3em] text-white/30 uppercase text-[10px] mr-2">Genre</span>
              <span className="font-semibold text-white/75 capitalize">{genre}</span>
            </p>
          )}
        </div>

        {/* Footer brand line */}
        <div className="flex flex-col items-center gap-2 pt-3">
          <span aria-hidden="true" className="h-px w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <p className="text-[9px] tracking-[0.35em] text-white/25 uppercase">
            Created using Toonflow Studio Paint
          </p>
        </div>
      </div>
    </section>
  )
}
