// Server shell for the novel detail page.
//
// The interactive page is a client component (Firestore realtime, live counters,
// chapter search). That left this route with NO per-title metadata: every novel
// URL in the sitemap rendered the root layout's generic "Toonflow Studio Paint"
// title, no description, no canonical and no share image — so thousands of
// submitted URLs looked like duplicates to Google and every shared link produced
// an identical card. Fetching the doc here fixes all of that at the source, and
// puts the Book/Breadcrumb entities in the raw HTML instead of behind hydration.
import type { Metadata } from 'next'
import NovelDetailClient from './NovelDetailClient'
import JsonLd from '@/components/seo/JsonLd'
import { catalogItemSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { getNovelMeta, isIndexable, synopsisSnippet, absoluteUrl } from '@/lib/seo/contentMeta'
import { toTitleCase } from '@/lib/utils/formatters'

interface NovelPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: NovelPageProps): Promise<Metadata> {
  const { id } = await params
  const novel = await getNovelMeta(id)

  // Unknown id (or Firestore unavailable) — stay generic rather than inventing a
  // title, and keep it out of the index since there's nothing to rank.
  if (!novel || !novel.title) {
    return { title: 'Novel', robots: { index: false, follow: true } }
  }

  const title = toTitleCase(novel.title)
  const description = novel.synopsis
    ? synopsisSnippet(novel.synopsis, novel.title)
    : `Read ${title}${novel.authorName ? ` by ${novel.authorName}` : ''} on Toonflow Studio Paint.`
  const canonical = `/novel/${id}`
  const indexable = isIndexable(novel.status, novel.visibility)

  return {
    title,
    description,
    alternates: { canonical },
    // Drafts and private novels are reachable by direct link but must never be
    // indexed — they're the creator's unpublished work.
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'book',
      title,
      description,
      url: absoluteUrl(canonical),
      ...(novel.coverURL
        ? { images: [{ url: novel.coverURL, alt: `${title} cover` }] }
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

export default async function NovelDetailPage({ params }: NovelPageProps) {
  const { id } = await params
  const novel = await getNovelMeta(id)
  const indexable = novel && isIndexable(novel.status, novel.visibility)

  return (
    <>
      {/* Structured data only for content that is actually public — never
          describe a draft to a crawler. */}
      {novel && indexable && (
        <>
          <JsonLd
            data={catalogItemSchema({
              type: 'Book',
              name: toTitleCase(novel.title),
              path: `/novel/${id}`,
              description: novel.synopsis || undefined,
              image: novel.coverURL,
              authorName: novel.authorName,
              genres: novel.genres,
              rating: novel.rating,
              ratingCount: novel.ratingCount,
              partCount: novel.partCount,
              datePublished: novel.publishedAt,
              dateModified: novel.updatedAt,
            })}
          />
          <JsonLd
            data={breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Browse', path: '/browse' },
              { name: toTitleCase(novel.title), path: `/novel/${id}` },
            ])}
          />
        </>
      )}
      <NovelDetailClient />
    </>
  )
}
