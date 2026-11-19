import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, Calendar, ExternalLink, Layers, Star, Users } from 'lucide-react'
import { chapterLabel, getMangaDetail, mangaSynopsis } from '@/lib/mangadex/client'
import { formatCount, toTitleCase } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface MangaPageProps {
  params: Promise<{ id: string }>
}

export const revalidate = 3600

const STATUS_BADGE: Record<string, string> = {
  ongoing: 'bg-accent/10 text-accent border-accent/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  hiatus: 'bg-warning/10 text-warning border-warning/20',
  cancelled: 'bg-danger/10 text-danger border-danger/20',
  unknown: 'bg-bg-elevated text-text-muted border-bg-border',
}

function formatChapterDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export async function generateMetadata({ params }: MangaPageProps): Promise<Metadata> {
  const { id } = await params
  const manga = await getMangaDetail(id)

  if (!manga) {
    return { title: 'Manga', robots: { index: false, follow: true } }
  }

  const title = toTitleCase(manga.title)
  const description = manga.description
    ? mangaSynopsis(manga.description, 160)
    : `Read ${title} online, with all chapters in order.`

  return {
    title,
    description,
    alternates: { canonical: `/manga/${id}` },
    openGraph: {
      type: 'article',
      title,
      description,
      ...(manga.coverURL ? { images: [{ url: manga.coverURL, alt: `${title} cover` }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(manga.coverURL ? { images: [manga.coverURL] } : {}),
    },
  }
}

export default async function MangaDetailPage({ params }: MangaPageProps) {
  const { id } = await params
  const manga = await getMangaDetail(id)
  if (!manga) notFound()

  const chapters = manga.chapters
  const firstChapter = chapters[0]
  const latestChapter = chapters[chapters.length - 1]
  const badgeClass = STATUS_BADGE[manga.status] ?? STATUS_BADGE.unknown

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-40 sm:w-48 aspect-[2/3] rounded-2xl bg-bg-elevated flex-shrink-0 overflow-hidden shadow-xl self-start">
          {manga.coverURL ? (
            // Cover is served through /api/img; referrerPolicy guards the
            // worker-proxied case against MangaDex's hotlink placeholder.
            // eslint-disable-next-line @next/next/no-img-element -- runtime-configured MangaDex CDN host (see MangaCard).
            <img
              src={manga.coverURL}
              alt={`${manga.title} cover`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Layers size={32} className="text-text-muted" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <span
              className={cn(
                'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border mb-2 capitalize',
                badgeClass
              )}
            >
              {manga.status}
            </span>
            <h1 className="text-2xl font-bold text-text leading-tight break-words">
              {toTitleCase(manga.title)}
            </h1>
            <p className="text-sm text-text-secondary mt-1">{manga.authorName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} aria-hidden="true" />
              {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden="true" />
              {formatCount(manga.follows)} followers
            </span>
            {manga.rating > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Star size={14} aria-hidden="true" />
                {manga.rating.toFixed(1)} / 5
              </span>
            )}
            {manga.year && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden="true" />
                {manga.year}
              </span>
            )}
          </div>

          {manga.description && (
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {manga.description}
            </p>
          )}

          {manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {manga.genres.slice(0, 8).map((genre) => (
                <span
                  key={genre}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-bg text-white/50 border border-bg-border capitalize"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {firstChapter ? (
              <Link href={`/manga/${manga.id}/chapter/${firstChapter.id}`} className="btn-accent">
                <BookOpen size={16} aria-hidden="true" />
                Start Reading
              </Link>
            ) : (
              <span className="text-sm text-text-muted">
                No readable chapters are available on MangaDex.
              </span>
            )}
            <a
              href={`https://mangadex.org/title/${manga.id}`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost text-sm"
            >
              View on MangaDex
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Chapter list */}
      <section aria-labelledby="chapter-list-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="chapter-list-heading" className="section-heading">
            Chapters
          </h2>
          {latestChapter && (
            <span className="text-xs text-white/40">
              Latest: {latestChapter.chapter ? `Ch. ${latestChapter.chapter}` : 'Chapter'}
            </span>
          )}
        </div>

        {chapters.length === 0 ? (
          <p className="text-sm text-text-muted py-6">
            No readable chapters are hosted on MangaDex for this series.
          </p>
        ) : (
          <ol className="divide-y divide-bg-border rounded-xl border border-bg-border overflow-hidden">
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/manga/${manga.id}/chapter/${chapter.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm bg-bg-card hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-text">{chapterLabel(chapter)}</span>
                    {chapter.groupName && (
                      <span className="block truncate text-[11px] text-text-muted mt-0.5">
                        {chapter.groupName}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-white/40">
                    {formatChapterDate(chapter.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-xs text-white/30">
        Series data and chapter pages are provided by MangaDex. All rights belong to their
        respective creators and publishers.
      </p>
    </div>
  )
}
