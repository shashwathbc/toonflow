import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { chapterLabel, getChapterPages, getMangaDetail } from '@/lib/mangadex/client'
import { toTitleCase } from '@/lib/utils/formatters'

interface MangaChapterPageProps {
  params: Promise<{ id: string; chapterId: string }>
}

export const revalidate = 3600

export async function generateMetadata({ params }: MangaChapterPageProps): Promise<Metadata> {
  const { id, chapterId } = await params
  const manga = await getMangaDetail(id)
  if (!manga) {
    return { title: 'Chapter', robots: { index: false, follow: true } }
  }
  const chapter = manga.chapters.find((c) => c.id === chapterId)
  const label = chapter ? chapterLabel(chapter) : 'Chapter'

  return {
    title: `${label} — ${toTitleCase(manga.title)}`,
    description: `Read ${label} of ${toTitleCase(manga.title)} online.`,
    alternates: { canonical: `/manga/${id}/chapter/${chapterId}` },
  }
}

export default async function MangaChapterPage({ params }: MangaChapterPageProps) {
  const { id, chapterId } = await params
  const [manga, pages] = await Promise.all([getMangaDetail(id), getChapterPages(chapterId)])
  if (!manga) notFound()

  const index = manga.chapters.findIndex((c) => c.id === chapterId)
  const chapter = index >= 0 ? manga.chapters[index] : null
  const prevChapter = index > 0 ? manga.chapters[index - 1] : null
  const nextChapter = index >= 0 && index < manga.chapters.length - 1 ? manga.chapters[index + 1] : null
  const seriesHref = `/manga/${manga.id}`
  const label = chapter ? chapterLabel(chapter) : 'Chapter'

  return (
    <div className="min-h-screen bg-black">
      {/* Reader chrome */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-4xl items-center gap-3 px-3">
          <Link
            href={seriesHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label={`Back to ${manga.title}`}
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Series</span>
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-sm text-white/80">
            <span className="text-white/50">{toTitleCase(manga.title)}</span>
            <span className="mx-1.5 text-white/30">·</span>
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {prevChapter ? (
              <Link
                href={`/manga/${manga.id}/chapter/${prevChapter.id}`}
                className="rounded p-1.5 text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Previous chapter"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span className="p-1.5 text-white/15">
                <ChevronLeft size={18} aria-hidden="true" />
              </span>
            )}
            {nextChapter ? (
              <Link
                href={`/manga/${manga.id}/chapter/${nextChapter.id}`}
                className="rounded p-1.5 text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Next chapter"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <span className="p-1.5 text-white/15">
                <ChevronRight size={18} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </header>

      {pages.length === 0 ? (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold text-white mb-2">Chapter pages unavailable</h1>
          <p className="text-sm text-white/50 mb-6">
            MangaDex is not hosting readable pages for this chapter. Try another chapter or read it
            on MangaDex.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={seriesHref} className="btn-ghost text-sm">
              Back to series
            </Link>
            <a
              href={`https://mangadex.org/chapter/${chapterId}`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-accent text-sm"
            >
              Open on MangaDex
            </a>
          </div>
        </div>
      ) : (
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl">
          <h1 className="sr-only">{`${toTitleCase(manga.title)} — ${label}`}</h1>
          {pages.map((page) => (
            // Pages come through /api/img; referrerPolicy guards the
            // worker-proxied case against MangaDex's hotlink placeholder.
            // eslint-disable-next-line @next/next/no-img-element -- chapter pages come from the MangaDex at-home CDN (runtime-configured proxy).
            <img
              key={page.index}
              src={page.url}
              alt={`Page ${page.index + 1} of ${label}`}
              loading={page.index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              className="block h-auto w-full"
            />
          ))}

          {/* Chapter footer navigation */}
          <nav
            aria-label="Chapter navigation"
            className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-6"
          >
            {prevChapter ? (
              <Link
                href={`/manga/${manga.id}/chapter/${prevChapter.id}`}
                className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            <Link
              href={seriesHref}
              className="text-sm text-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              All chapters
            </Link>
            {nextChapter ? (
              <Link
                href={`/manga/${manga.id}/chapter/${nextChapter.id}`}
                className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>
      )}
    </div>
  )
}
