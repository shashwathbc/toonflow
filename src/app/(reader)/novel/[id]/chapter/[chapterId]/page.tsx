// Server shell for the chapter reader — supplies the metadata the client reader
// can't. Chapter URLs are the largest crawlable surface on the site (one per
// chapter per novel) and every one of them previously shared the root layout's
// generic title with no description and no canonical.
import type { Metadata } from 'next'
import ChapterReaderClient from './ChapterReaderClient'
import JsonLd from '@/components/seo/JsonLd'
import { chapterSchema, breadcrumbSchema } from '@/lib/seo/schema'
import {
  getNovelMeta,
  getChapterMeta,
  isIndexable,
  toDescription,
  absoluteUrl,
} from '@/lib/seo/contentMeta'
import { toTitleCase } from '@/lib/utils/formatters'

interface ChapterPageProps {
  params: Promise<{ id: string; chapterId: string }>
}

/** "Chapter 12: The Long Road — Ashfall" (falls back gracefully when the chapter
 *  has no title of its own, which is common for serialized fiction). */
function chapterLabel(number: number, title: string): string {
  const prefix = number > 0 ? `Chapter ${number}` : 'Chapter'
  return title ? `${prefix}: ${title}` : prefix
}

export async function generateMetadata({ params }: ChapterPageProps): Promise<Metadata> {
  const { id, chapterId } = await params
  const [novel, chapter] = await Promise.all([getNovelMeta(id), getChapterMeta(id, chapterId)])

  if (!novel || !chapter) {
    return { title: 'Chapter', robots: { index: false, follow: true } }
  }

  const novelTitle = toTitleCase(novel.title)
  const label = chapterLabel(chapter.number, chapter.title)
  const title = `${label} — ${novelTitle}`
  const description = toDescription(
    `Read ${label} of ${novelTitle}${novel.authorName ? ` by ${novel.authorName}` : ''}.${
      novel.synopsis ? ` ${novel.synopsis}` : ''
    }`
  )
  const canonical = `/novel/${id}/chapter/${chapterId}`
  const indexable = isIndexable(novel.status, novel.visibility)

  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title,
      description,
      url: absoluteUrl(canonical),
      ...(novel.coverURL
        ? { images: [{ url: novel.coverURL, alt: `${novelTitle} cover` }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(novel.coverURL ? { images: [novel.coverURL] } : {}),
    },
  }
}

export default async function ChapterReaderPage({ params }: ChapterPageProps) {
  const { id, chapterId } = await params
  const [novel, chapter] = await Promise.all([getNovelMeta(id), getChapterMeta(id, chapterId)])
  const indexable = novel && isIndexable(novel.status, novel.visibility)

  return (
    <>
      {novel && chapter && indexable && (
        <>
          <JsonLd
            data={chapterSchema({
              name: chapterLabel(chapter.number, chapter.title),
              path: `/novel/${id}/chapter/${chapterId}`,
              position: chapter.number,
              seriesName: toTitleCase(novel.title),
              seriesPath: `/novel/${id}`,
              image: novel.coverURL,
            })}
          />
          <JsonLd
            data={breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: toTitleCase(novel.title), path: `/novel/${id}` },
              {
                name: chapterLabel(chapter.number, chapter.title),
                path: `/novel/${id}/chapter/${chapterId}`,
              },
            ])}
          />
        </>
      )}
      <ChapterReaderClient />
    </>
  )
}
