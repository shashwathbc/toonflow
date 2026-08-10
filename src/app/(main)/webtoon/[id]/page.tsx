// Server shell for the webtoon detail page — see the sibling novel/[id]/page.tsx
// for the full rationale. Same problem, same fix: per-title metadata, canonical,
// share image and server-rendered structured data for a route that previously
// had none.
import type { Metadata } from 'next'
import WebtoonDetailClient from './WebtoonDetailClient'
import JsonLd from '@/components/seo/JsonLd'
import { catalogItemSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { getWebtoonMeta, isIndexable, synopsisSnippet, absoluteUrl } from '@/lib/seo/contentMeta'
import { toTitleCase } from '@/lib/utils/formatters'

interface WebtoonPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: WebtoonPageProps): Promise<Metadata> {
  const { id } = await params
  const webtoon = await getWebtoonMeta(id)

  if (!webtoon || !webtoon.title) {
    return { title: 'Webtoon', robots: { index: false, follow: true } }
  }

  const title = toTitleCase(webtoon.title)
  const description = webtoon.synopsis
    ? synopsisSnippet(webtoon.synopsis, webtoon.title)
    : `Read ${title}${webtoon.authorName ? ` by ${webtoon.authorName}` : ''} on Toonflow Studio Paint.`
  const canonical = `/webtoon/${id}`
  // `unlisted` webtoons are deliberately link-only — isIndexable() excludes them.
  const indexable = isIndexable(webtoon.status, webtoon.visibility)

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
      ...(webtoon.coverURL
        ? { images: [{ url: webtoon.coverURL, alt: `${title} cover` }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(webtoon.coverURL ? { images: [webtoon.coverURL] } : {}),
    },
  }
}

export default async function WebtoonDetailPage({ params }: WebtoonPageProps) {
  const { id } = await params
  const webtoon = await getWebtoonMeta(id)
  const indexable = webtoon && isIndexable(webtoon.status, webtoon.visibility)

  return (
    <>
      {webtoon && indexable && (
        <>
          <JsonLd
            data={catalogItemSchema({
              type: 'ComicSeries',
              name: toTitleCase(webtoon.title),
              path: `/webtoon/${id}`,
              description: webtoon.synopsis || undefined,
              image: webtoon.coverURL,
              authorName: webtoon.authorName,
              genres: webtoon.genres,
              rating: webtoon.rating,
              ratingCount: webtoon.ratingCount,
              partCount: webtoon.partCount,
              datePublished: webtoon.publishedAt,
              dateModified: webtoon.updatedAt,
            })}
          />
          <JsonLd
            data={breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Browse', path: '/browse' },
              { name: toTitleCase(webtoon.title), path: `/webtoon/${id}` },
            ])}
          />
        </>
      )}
      <WebtoonDetailClient />
    </>
  )
}
