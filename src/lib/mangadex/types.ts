/**
 * Plain, serialisable shapes for content sourced from MangaDex.
 *
 * These are deliberately NOT the Firestore `Novel`/`Webtoon` types: MangaDex
 * series are owned by MangaDex, not by a Toonflow creator, so they carry no
 * authorId, visibility, premium flags or Firestore timestamps. Keeping them
 * separate stops a MangaDex id from ever being treated as a local document id.
 */

export type MangaStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown'

export interface MangaSummary {
  id: string
  title: string
  description: string
  coverURL: string | null
  year: number | null
  status: MangaStatus
  originalLanguage: string
  genres: string[]
  /** MangaDex followers — the ranking metric for the "top" list. */
  follows: number
  /** MangaDex average rating (out of 10) normalised to 5, or 0 when unrated. */
  rating: number
  lastChapter: string | null
}

export interface MangaChapter {
  id: string
  /** Chapter number as MangaDex stores it (may be "12.5" or null). */
  chapter: string | null
  volume: string | null
  title: string
  pages: number
  language: string
  groupName: string | null
  publishedAt: string | null
}

export interface MangaDetail extends MangaSummary {
  authorName: string
  /** Readable chapters, de-duplicated and sorted ascending (volume, chapter). */
  chapters: MangaChapter[]
}

export interface MangaPage {
  index: number
  url: string
}
