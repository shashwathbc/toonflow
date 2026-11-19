// Server-side MangaDex client.
//
// All MangaDex traffic goes through this module — it is the only place that
// knows about the proxy worker, the API shapes, or the chapter ordering rules.
// Nothing here is imported by a client component (only the plain types in
// ./types are), so the API key-free proxy URL never reaches the browser.
//
// The Toonflow MangaDex proxy worker (see docs in the worker itself) forwards:
//   /proxy/*            -> https://api.mangadex.org/*
//   /covers/*           -> https://uploads.mangadex.org/*
//   /chapter-images/*   -> the at-home CDN origin recorded by the API
// Setting MANGADEX_PROXY_URL routes API calls and images through it; without it
// the server talks to api.mangadex.org directly and serves images through the
// same-origin /api/img proxy (MangaDex 403s/404s browser user-agents, so a
// direct <img> to its CDNs cannot work).

import { cache } from 'react'
import { proxyImageUrl } from '@/lib/utils/imageProxy'
import type { MangaChapter, MangaDetail, MangaPage, MangaStatus, MangaSummary } from './types'

const MANGADEX_API = 'https://api.mangadex.org'
const MANGADEX_CDN = 'https://uploads.mangadex.org'

/**
 * The hand-picked MangaDex series shown in the MangaDex collections, in display
 * order. Add a title by pasting its ID from its mangadex.org/title/<id>/ URL.
 */
export const CURATED_MANGA_IDS: readonly string[] = [
  '6b1eb93e-473a-4ab3-9922-1a66d2a29a4a', // Naruto
  '31d67518-dd05-46d2-9d59-4ba730a23a10', // Rebirth of the Urban Immortal Cultivator
  '6eac68d9-b81f-4612-9672-1fa261007d61', // Metropolitan Supremacy System
  'b1461071-bfbb-43e7-a5b6-a7ba5904649f', // Wu Lian Dianfeng
  '69e218ec-93eb-4025-ae39-33d47b1160e0', // The Servant is the Demon King
  'ee6bfae5-9715-427b-b29e-3bec88595df7', // Yongzhe x Nu Mowang
  'a2c1d849-af05-4bbc-b2a7-866ebb10331f', // One Piece
]

/** Ranking + chapter data changes slowly; one hour of ISR is plenty and keeps
 *  the cold-render fan-out (one chapter probe per candidate) at once an hour. */
const REVALIDATE_SECONDS = 60 * 60

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Toonflow/1.0 (mangadex catalog)',
} as const

function proxyBase(): string {
  return (process.env.MANGADEX_PROXY_URL ?? '').trim().replace(/\/+$/, '')
}

function apiUrl(path: string): string {
  const base = proxyBase()
  // The worker strips the leading /proxy and appends the rest to the API root.
  return base ? `${base}/proxy${path}` : `${MANGADEX_API}${path}`
}

/**
 * URL for a cover file, usable directly in an <img>.
 *
 * MangaDex's uploads CDN 403s browser user-agents ("Bot challenge not
 * passed"), which Chrome surfaces as ERR_BLOCKED_BY_ORB — a blank cover. So the
 * direct case goes through our same-origin /api/img proxy, which fetches the
 * bytes from the server where no browser UA is sent.
 */
export function coverUrl(mangaId: string, fileName: string | null | undefined): string | null {
  if (!fileName) return null
  const base = proxyBase()
  // /covers/... on the worker maps to https://uploads.mangadex.org/covers/...
  if (base) return `${base}/covers/covers/${mangaId}/${fileName}`
  return proxyImageUrl(`${MANGADEX_CDN}/covers/${mangaId}/${fileName}`)
}

/** URL for one page of a chapter, usable directly in an <img>. */
function pageUrl(cdnOrigin: string, hash: string, file: string): string {
  const direct = `${cdnOrigin}/data/${hash}/${file}`
  const base = proxyBase()
  // Without the worker, the at-home CDN answers a browser UA with 404 (bot
  // challenge), so pages go through the same-origin image proxy.
  if (!base) return proxyImageUrl(direct)
  // The worker needs the CDN origin in base64url so it can validate the host.
  const encoded = Buffer.from(cdnOrigin, 'utf8').toString('base64url')
  return `${base}/chapter-images/${encoded}/${hash}/${file}`
}

async function mdFetch<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: FETCH_HEADERS,
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`MangaDex ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Wire shapes (only the fields we read)
// ---------------------------------------------------------------------------

interface MangaDexRelationship {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

interface MangaDexManga {
  id: string
  attributes: {
    title: Record<string, string>
    description: Record<string, string>
    year: number | null
    status: string | null
    originalLanguage: string
    lastChapter: string | null
    tags?: { attributes: { name: Record<string, string> } }[]
  }
  relationships?: MangaDexRelationship[]
}

interface MangaCollection<T> {
  result: string
  data: T[]
}

interface ChapterDoc {
  id: string
  attributes: {
    volume: string | null
    chapter: string | null
    title: string | null
    translatedLanguage: string
    pages: number
    publishAt: string | null
  }
  relationships?: MangaDexRelationship[]
}

interface ChapterFeed {
  result: string
  data: ChapterDoc[]
  total: number
}

interface AtHomeResponse {
  result: string
  baseUrl: string
  chapter: {
    hash: string
    data: string[]
  }
}

interface StatisticsResponse {
  result: string
  statistics: Record<
    string,
    { follows?: number; rating?: { average?: number | null } } | undefined
  >
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function localised(values: Record<string, string> | undefined, prefer = 'en'): string {
  if (!values) return ''
  return values[prefer] ?? Object.values(values).find((v) => v.trim().length > 0) ?? ''
}

/** MangaDex descriptions are Markdown with links and stray separators. Plain
 *  text reads better on the detail page and can't smuggle markup into React. */
function cleanDescription(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normaliseStatus(raw: string | null): MangaStatus {
  switch (raw) {
    case 'ongoing':
    case 'completed':
    case 'hiatus':
    case 'cancelled':
      return raw
    default:
      return 'unknown'
  }
}

function relationship(manga: MangaDexManga, type: string): MangaDexRelationship | undefined {
  return manga.relationships?.find((r) => r.type === type)
}

function toSummary(manga: MangaDexManga): MangaSummary {
  const cover = relationship(manga, 'cover_art')
  const fileName = typeof cover?.attributes?.fileName === 'string' ? cover.attributes.fileName : null
  const genres = (manga.attributes.tags ?? [])
    .map((tag) => localised(tag.attributes.name))
    .filter(Boolean)

  return {
    id: manga.id,
    title: localised(manga.attributes.title),
    description: cleanDescription(localised(manga.attributes.description)),
    coverURL: coverUrl(manga.id, fileName),
    year: manga.attributes.year ?? null,
    status: normaliseStatus(manga.attributes.status),
    originalLanguage: manga.attributes.originalLanguage ?? '',
    genres,
    follows: 0,
    rating: 0,
    lastChapter: manga.attributes.lastChapter || null,
  }
}

/** Numeric chapter key; unnumbered chapters sort after numbered ones. */
function chapterNumber(chapter: string | null): number {
  if (!chapter) return Number.POSITIVE_INFINITY
  const parsed = Number.parseFloat(chapter)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

function volumeNumber(volume: string | null): number {
  if (!volume) return 0
  const parsed = Number.parseFloat(volume)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Stable ascending order: volume first, then chapter number, then raw chapter
 *  string (handles "12.5" and duplicate numbering across volumes). */
function compareChapters(a: MangaChapter, b: MangaChapter): number {
  const byVolume = volumeNumber(a.volume) - volumeNumber(b.volume)
  if (byVolume !== 0) return byVolume
  const byNumber = chapterNumber(a.chapter) - chapterNumber(b.chapter)
  if (byNumber !== 0) return byNumber
  return (a.chapter ?? '').localeCompare(b.chapter ?? '', undefined, { numeric: true })
}

function toChapter(doc: ChapterDoc): MangaChapter {
  const group = doc.relationships?.find((r) => r.type === 'scanlation_group')
  const groupName = typeof group?.attributes?.name === 'string' ? group.attributes.name : null
  return {
    id: doc.id,
    chapter: doc.attributes.chapter,
    volume: doc.attributes.volume,
    title: doc.attributes.title ?? '',
    pages: doc.attributes.pages ?? 0,
    language: doc.attributes.translatedLanguage,
    groupName,
    publishedAt: doc.attributes.publishAt,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function attachStatistics(items: MangaSummary[]): Promise<MangaSummary[]> {
  if (items.length === 0) return items
  try {
    const params = new URLSearchParams()
    for (const item of items) params.append('manga[]', item.id)
    const stats = await mdFetch<StatisticsResponse>(`/statistics/manga?${params.toString()}`)
    return items.map((item) => {
      const entry = stats.statistics[item.id]
      const average = entry?.rating?.average ?? 0
      return {
        ...item,
        follows: entry?.follows ?? 0,
        rating: average > 0 ? Math.round((average / 2) * 10) / 10 : 0,
      }
    })
  } catch {
    return items
  }
}

/**
 * The curated MangaDex series (see CURATED_MANGA_IDS), in the order the list
 * declares. The API returns `ids[]` results unordered and silently drops IDs it
 * does not know, so the result is re-ordered and missing titles are skipped.
 */
export const getTopManga = cache(async (limit = CURATED_MANGA_IDS.length): Promise<MangaSummary[]> => {
  const ids = CURATED_MANGA_IDS.slice(0, limit)
  if (ids.length === 0) return []

  const params = new URLSearchParams()
  params.set('limit', String(ids.length))
  for (const id of ids) params.append('ids[]', id)
  params.append('includes[]', 'cover_art')

  const collection = await mdFetch<MangaCollection<MangaDexManga>>(`/manga?${params.toString()}`)
  const byId = new Map(collection.data.map((manga) => [manga.id, toSummary(manga)]))
  const ordered = ids.flatMap((id) => {
    const manga = byId.get(id)
    return manga ? [manga] : []
  })

  return attachStatistics(ordered)
})

/** A single series with its full, ordered chapter list. */
export const getMangaDetail = cache(async (id: string): Promise<MangaDetail | null> => {
  try {
    const manga = await mdFetch<{ data: MangaDexManga }>(
      `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`
    )
    const [summary, chapters] = await Promise.all([
      attachStatistics([toSummary(manga.data)]),
      // A feed hiccup should degrade to "no chapters", not a 404 for a series
      // that clearly exists.
      getMangaChapters(id).catch(() => []),
    ])
    const author = relationship(manga.data, 'author') ?? relationship(manga.data, 'artist')
    const authorName =
      typeof author?.attributes?.name === 'string' ? author.attributes.name : 'MangaDex'

    return { ...summary[0], authorName, chapters }
  } catch (err) {
    console.error('[mangadex] detail failed:', err)
    return null
  }
})

/**
 * Every readable English chapter, de-duplicated and in reading order.
 * MangaDex's feed returns one doc per scanlation group, so the same chapter can
 * appear several times; the first upload for a volume+chapter pair is kept.
 */
async function getMangaChapters(id: string): Promise<MangaChapter[]> {
  const PAGE = 500
  const MAX_PAGES = 6
  const seen = new Map<string, MangaChapter>()

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE
    const feed = await mdFetch<ChapterFeed>(
      `/manga/${id}/feed?limit=${PAGE}&offset=${offset}` +
        '&translatedLanguage[]=en&order[volume]=asc&order[chapter]=asc' +
        '&includeExternalUrl=0&contentRating[]=safe&contentRating[]=suggestive'
    )

    for (const doc of feed.data) {
      const chapter = toChapter(doc)
      if (chapter.pages <= 0) continue
      const key = `${chapter.volume ?? ''}|${chapter.chapter ?? chapter.id}`
      if (!seen.has(key)) seen.set(key, chapter)
    }

    if (feed.data.length < PAGE || offset + feed.data.length >= feed.total) break
  }

  return Array.from(seen.values()).sort(compareChapters)
}

const EMPTY_PAGES: MangaPage[] = []

/** Page images for one chapter, in reading order. Empty for unreadable or
 *  externally hosted chapters, or when MangaDex is unavailable. */
export const getChapterPages = cache(async (chapterId: string): Promise<MangaPage[]> => {
  try {
    const data = await mdFetch<AtHomeResponse>(`/at-home/server/${chapterId}`)
    const { hash, data: files } = data.chapter
    if (!data.baseUrl || !hash || !Array.isArray(files)) return EMPTY_PAGES
    return files.map((file, index) => ({
      index,
      url: pageUrl(data.baseUrl, hash, file),
    }))
  } catch (err) {
    console.error('[mangadex] chapter pages failed:', err)
    return EMPTY_PAGES
  }
})

/** Human label for a chapter, used by the detail list and the reader. */
export function chapterLabel(chapter: Pick<MangaChapter, 'chapter' | 'volume' | 'title'>): string {
  const parts: string[] = []
  if (chapter.volume) parts.push(`Vol. ${chapter.volume}`)
  parts.push(chapter.chapter ? `Ch. ${chapter.chapter}` : 'Chapter')
  const prefix = parts.join(' ')
  return chapter.title ? `${prefix} — ${chapter.title}` : prefix
}

/** A short, plain-text synopsis for cards and meta descriptions. */
export function mangaSynopsis(description: string, maxLength = 220): string {
  const single = description.replace(/\s+/g, ' ').trim()
  if (single.length <= maxLength) return single
  return `${single.slice(0, maxLength).trimEnd()}…`
}
