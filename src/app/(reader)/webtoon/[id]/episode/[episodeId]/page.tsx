// Server shell for the episode reader — same rationale as the chapter reader
// (see ../../../novel/[id]/chapter/[chapterId]/page.tsx).
import type { Metadata } from 'next'
import EpisodeReaderClient from './EpisodeReaderClient'
import JsonLd from '@/components/seo/JsonLd'
import { chapterSchema, breadcrumbSchema } from '@/lib/seo/schema'
import {
  getWebtoonMeta,
  getEpisodeMeta,
  isIndexable,
  toDescription,
  absoluteUrl,
} from '@/lib/seo/contentMeta'
import { toTitleCase } from '@/lib/utils/formatters'

interface EpisodePageProps {
  params: Promise<{ id: string; episodeId: string }>
}

function episodeLabel(number: number, title: string): string {
  const prefix = number > 0 ? `Episode ${number}` : 'Episode'
  return title ? `${prefix}: ${title}` : prefix
}

export async function generateMetadata({ params }: EpisodePageProps): Promise<Metadata> {
  const { id, episodeId } = await params
  const [webtoon, episode] = await Promise.all([
    getWebtoonMeta(id),
    getEpisodeMeta(id, episodeId),
  ])

  if (!webtoon || !episode) {
    return { title: 'Episode', robots: { index: false, follow: true } }
  }

  const seriesTitle = toTitleCase(webtoon.title)
  const label = episodeLabel(episode.number, episode.title)
  const title = `${label} — ${seriesTitle}`
  const description = toDescription(
    `Read ${label} of ${seriesTitle}${webtoon.authorName ? ` by ${webtoon.authorName}` : ''}.${
      webtoon.synopsis ? ` ${webtoon.synopsis}` : ''
    }`
  )
  const canonical = `/webtoon/${id}/episode/${episodeId}`
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
        ? { images: [{ url: webtoon.coverURL, alt: `${seriesTitle} cover` }] }
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

export default async function EpisodeReaderPage({ params }: EpisodePageProps) {
  const { id, episodeId } = await params
  const [webtoon, episode] = await Promise.all([
    getWebtoonMeta(id),
    getEpisodeMeta(id, episodeId),
  ])
  const indexable = webtoon && isIndexable(webtoon.status, webtoon.visibility)

  return (
    <>
      {webtoon && episode && indexable && (
        <>
          <JsonLd
            data={chapterSchema({
              name: episodeLabel(episode.number, episode.title),
              path: `/webtoon/${id}/episode/${episodeId}`,
              position: episode.number,
              seriesName: toTitleCase(webtoon.title),
              seriesPath: `/webtoon/${id}`,
              image: webtoon.coverURL,
            })}
          />
          <JsonLd
            data={breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: toTitleCase(webtoon.title), path: `/webtoon/${id}` },
              {
                name: episodeLabel(episode.number, episode.title),
                path: `/webtoon/${id}/episode/${episodeId}`,
              },
            ])}
          />
        </>
      )}
      <EpisodeReaderClient />
    </>
  )
}
