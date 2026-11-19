import Link from 'next/link'
import { ArrowRight, Library } from 'lucide-react'
import MangaCard from './MangaCard'
import type { MangaSummary } from '@/lib/mangadex/types'

interface MangaGridProps {
  manga: MangaSummary[]
  id?: string
  title?: string
  description?: string
  /** Optional "View all" target — omitted on the full list page. */
  viewAllHref?: string
  /** Center the empty state copy (used when embedded on /browse). */
  compactEmpty?: boolean
}

/** Responsive grid of MangaDex series, shared by /manga and /browse. */
export default function MangaGrid({
  manga,
  id,
  title,
  description,
  viewAllHref,
  compactEmpty = false,
}: MangaGridProps) {
  return (
    <section
      className="max-w-screen-xl mx-auto px-4 py-8"
      {...(id ? { 'aria-labelledby': id } : { 'aria-label': title ?? 'Manga' })}
    >
      {(title || description) && (
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            {title && (
              <h2 id={id} className="section-heading">
                {title}
              </h2>
            )}
            {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
          </div>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="shrink-0 text-sm text-white/50 hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              View All <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {manga.length === 0 ? (
        <div className={compactEmpty ? 'flex flex-col items-center py-10 text-center' : ''}>
          <Library size={32} className="text-white/20 mb-3" aria-hidden="true" />
          <p className="text-sm text-white/50">No manga available right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {manga.map((item) => (
            <MangaCard key={item.id} manga={item} />
          ))}
        </div>
      )}
    </section>
  )
}
