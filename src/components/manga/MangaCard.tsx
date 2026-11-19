import Link from 'next/link'
import { Layers, Star, Users } from 'lucide-react'
import type { MangaSummary } from '@/lib/mangadex/types'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'

/**
 * Catalog card for a MangaDex series.
 *
 * MangaDex covers live on third-party CDNs that are not in `next/image`'s
 * configured remote patterns, so this renders a plain lazy <img> instead of
 * CoverImage — and it must stay a plain component (no hooks) so the home feed
 * can render it inside its client tree without extra state.
 */
export default function MangaCard({ manga }: { manga: MangaSummary }) {
  const cardLabel = [
    `${manga.title} — manga`,
    manga.follows > 0 ? `${formatCount(manga.follows)} followers` : null,
    manga.rating > 0 ? `rated ${manga.rating.toFixed(1)} out of 5` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={`/manga/${manga.id}`}
      className="group block rounded-xl overflow-hidden bg-bg-card border border-bg-border hover:border-white/20 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={cardLabel}
    >
      <div className="relative aspect-[2/3] bg-bg-elevated overflow-hidden">
        {manga.coverURL ? (
          // coverURL is the same-origin /api/img proxy (MangaDex 403s browser
          // user-agents); referrerPolicy covers deployments that point at the
          // Toonflow worker instead, where the CDN's hotlink placeholder applies.
          // eslint-disable-next-line @next/next/no-img-element -- MangaDex CDN host is runtime-configured (proxy), so it cannot be pre-listed in next.config.
          <img
            src={manga.coverURL}
            alt={manga.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <Layers size={28} aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white border border-white/10">
            Manga
          </span>
        </div>
        {manga.status !== 'unknown' && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white capitalize border border-white/10">
              {manga.status}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1 min-h-[2.5em]">
          {toTitleCase(manga.title)}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/60">
          <span className="inline-flex items-center gap-1">
            <Users size={11} aria-hidden="true" />
            {formatCount(manga.follows)}
          </span>
          {manga.rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star size={11} aria-hidden="true" />
              {manga.rating.toFixed(1)}
            </span>
          )}
          {manga.lastChapter && (
            <span className="inline-flex items-center gap-1 truncate">
              <Layers size={11} aria-hidden="true" />
              Ch. {manga.lastChapter}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
