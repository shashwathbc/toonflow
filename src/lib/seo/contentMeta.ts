// Server-side metadata lookups for the public content catalog.
//
// The detail/reader pages are client components (they need Firestore realtime,
// view tracking and reader chrome), so their <title>/<meta> can't come from the
// render tree. These helpers run in `generateMetadata` on the server via the
// Admin SDK, which is also the only way Googlebot and every social-card scraper
// (Slack/X/WhatsApp/Discord — none of which execute JS) see a real title.
//
// Every helper is FAIL-SOFT: a missing credential or a Firestore outage returns
// null and the page falls back to the root layout's generic metadata. Metadata
// must never be the reason a page 500s.
import { cache } from 'react'
import { APP_URL } from '@/lib/utils/constants'
import type { ContentStatus } from '@/types/novel'

/** Statuses that represent publicly readable content. `draft` is excluded — a
 *  draft is the creator's private work-in-progress. Shared with sitemap.ts so
 *  "what is indexable" has exactly one definition. */
export const PUBLIC_STATUSES = ['published', 'ongoing', 'completed', 'hiatus'] as const

/** Content is indexable only when it is both publicly readable AND published.
 *  Webtoons additionally support `unlisted` — reachable by direct link but
 *  deliberately kept out of search, so it is NOT indexable. */
export function isIndexable(status?: string, visibility?: string): boolean {
  return (
    (PUBLIC_STATUSES as readonly string[]).includes(status ?? '') && visibility === 'public'
  )
}

export interface ContentMeta {
  id: string
  title: string
  synopsis: string
  coverURL: string | null
  authorName: string
  status: ContentStatus
  visibility: string
  genres: string[]
  rating: number
  ratingCount: number
  /** chapterCount for novels, episodeCount for webtoons */
  partCount: number
  updatedAt: Date | null
  publishedAt: Date | null
}

export interface PartMeta {
  id: string
  title: string
  /** chapterNumber for chapters, episodeNumber for episodes */
  number: number
}

/** Strip Markdown syntax down to plain prose.
 *
 *  Synopses are authored in the rich editor and the AI writer, and they very
 *  often arrive as Markdown — real catalog data starts `# Lord Krishna\n\nIn the
 *  shadow of prophecy…`. Piping that straight into <meta name="description">
 *  shipped a literal `#` and a duplicated title to Google and to every social
 *  card, so the syntax is removed before the snippet is cut. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → label
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '') // list markers
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, ' ') // thematic breaks
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/<[^>]+>/g, ' ') // stray HTML tags
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trim to a meta-description-sized snippet on a word boundary. Google renders
 *  roughly 155–160 chars; anything longer is truncated with an ellipsis anyway,
 *  so we do it ourselves and keep control of where the cut lands. */
export function toDescription(text: string, max = 155): string {
  const clean = stripMarkdown(text)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

/** Drop a leading heading that just repeats the title, so the description opens
 *  on real prose instead of echoing the <title> tag back at the reader. */
export function synopsisSnippet(synopsis: string, title: string): string {
  const stripped = stripMarkdown(synopsis)
  const lead = stripMarkdown(title).toLowerCase()
  const withoutEcho =
    lead && stripped.toLowerCase().startsWith(lead)
      ? stripped.slice(lead.length).replace(/^[\s—–:.-]+/, '')
      : stripped
  return toDescription(withoutEcho || stripped)
}

/** Absolute URL — OG/canonical tags must never be relative. */
export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function toDate(value: unknown): Date | null {
  const ts = value as { toDate?: () => Date } | undefined
  return typeof ts?.toDate === 'function' ? ts.toDate() : null
}

async function fetchDoc(path: string): Promise<Record<string, unknown> | null> {
  try {
    const { adminDb } = await import('@/lib/firebase/serverApp')
    const snap = await adminDb().doc(path).get()
    return snap.exists ? (snap.data() as Record<string, unknown>) : null
  } catch {
    return null // no credentials / Firestore down → generic metadata
  }
}

function toContentMeta(id: string, d: Record<string, unknown>, countKey: string): ContentMeta {
  return {
    id,
    title: typeof d.title === 'string' ? d.title : '',
    synopsis: typeof d.synopsis === 'string' ? d.synopsis : '',
    coverURL: typeof d.coverURL === 'string' ? d.coverURL : null,
    authorName: typeof d.authorName === 'string' ? d.authorName : '',
    status: d.status as ContentStatus,
    visibility: typeof d.visibility === 'string' ? d.visibility : 'private',
    genres: Array.isArray(d.genres) ? (d.genres as string[]) : [],
    rating: typeof d.rating === 'number' ? d.rating : 0,
    ratingCount: typeof d.ratingCount === 'number' ? d.ratingCount : 0,
    partCount: typeof d[countKey] === 'number' ? (d[countKey] as number) : 0,
    updatedAt: toDate(d.updatedAt),
    publishedAt: toDate(d.publishedAt),
  }
}

// `cache` dedupes within a single request, so generateMetadata and the page body
// asking for the same doc costs one Firestore read, not two.
export const getNovelMeta = cache(async (id: string): Promise<ContentMeta | null> => {
  const d = await fetchDoc(`novels/${id}`)
  return d ? toContentMeta(id, d, 'chapterCount') : null
})

export const getWebtoonMeta = cache(async (id: string): Promise<ContentMeta | null> => {
  const d = await fetchDoc(`webtoons/${id}`)
  return d ? toContentMeta(id, d, 'episodeCount') : null
})

export const getChapterMeta = cache(
  async (novelId: string, chapterId: string): Promise<PartMeta | null> => {
    const d = await fetchDoc(`novels/${novelId}/chapters/${chapterId}`)
    if (!d) return null
    return {
      id: chapterId,
      title: typeof d.title === 'string' ? d.title : '',
      number: typeof d.chapterNumber === 'number' ? d.chapterNumber : 0,
    }
  }
)

export const getEpisodeMeta = cache(
  async (webtoonId: string, episodeId: string): Promise<PartMeta | null> => {
    const d = await fetchDoc(`webtoons/${webtoonId}/episodes/${episodeId}`)
    if (!d) return null
    return {
      id: episodeId,
      title: typeof d.title === 'string' ? d.title : '',
      number: typeof d.episodeNumber === 'number' ? d.episodeNumber : 0,
    }
  }
)
