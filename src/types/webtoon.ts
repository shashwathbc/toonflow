import type { FirestoreTimestamp } from './user'
import type { ContentStatus, ContentGenre } from './novel'
import type { CanvasProject } from '@/store/useEditorStore'

export type { CanvasProject }

/** Horizontal share of the canvas a panel occupies in the strip layout */
export type PanelSpan = 'full' | 'half' | 'third' | 'two-thirds'

export interface PanelImage {
  url: string
  width: number
  height: number
  order: number
  altText?: string
  span?: PanelSpan
}

export interface Webtoon {
  id: string
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  title: string
  slug: string
  synopsis: string
  coverURL: string | null
  bannerURL?: string | null
  status: ContentStatus
  visibility: 'public' | 'unlisted' | 'private'
  genres: ContentGenre[]
  tags: string[]
  isPremium: boolean
  isFeatured: boolean
  isOriginal: boolean
  viewCount: number
  likeCount: number
  bookmarkCount: number
  episodeCount: number
  rating: number
  ratingCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

/**
 * Editable text overrides for the mandatory branded intro page every episode
 * opens with. The page itself is structural (always rendered before the panel
 * strip in editor and reader — it is not a panel, so it can never be deleted,
 * moved or duplicated); absent/empty fields fall back to series data.
 */
export interface EpisodeIntroMeta {
  /** Short hook line under the title. Default: first sentence of the synopsis. */
  tagline?: string
  /** "Story & Art" credit. Default: the webtoon's authorName. */
  creditLine?: string
}

/** Same contract as {@link EpisodeIntroMeta}, for the mandatory closing page. */
export interface EpisodeOutroMeta {
  /** Big farewell headline. Default: "Thank You for Reading". */
  message?: string
  /** Teaser under the headline. Default: "Next episode coming soon". */
  teaser?: string
  /** Creator handle / social line shown with the follow CTA. */
  handle?: string
}

export interface Episode {
  id: string
  webtoonId: string
  title: string
  episodeNumber: number
  panels: PanelImage[]
  thumbnailURL: string | null
  isPremium: boolean
  coinCost: number
  viewCount: number
  likeCount: number
  status: 'draft' | 'published'
  intro?: EpisodeIntroMeta
  outro?: EpisodeOutroMeta
  /** Infinite-canvas source project. Rich, non-destructive; the flat `panels`
   *  above are rasterized from this at publish time for the public reader. */
  canvasProject?: CanvasProject
  canvasUpdatedAt?: FirestoreTimestamp
  createdAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

/**
 * A recurring character in a webtoon's roster (`webtoons/{id}/characters`).
 * Kept per-series so pages can reuse consistent names/looks; `imageUrl` is an
 * optional reference portrait creators can drop straight onto a page.
 */
export interface Character {
  id: string
  webtoonId: string
  name: string
  role: string
  color: string
  imageUrl?: string | null
  notes?: string
  createdAt: FirestoreTimestamp
}

export type WebtoonCreateInput = Omit<
  Webtoon,
  'id' | 'authorId' | 'authorName' | 'authorPhotoURL' | 'viewCount' | 'likeCount' |
  'bookmarkCount' | 'episodeCount' | 'rating' | 'ratingCount' | 'createdAt' | 'updatedAt' | 'publishedAt'
>

export type EpisodeCreateInput = Omit<Episode, 'id' | 'webtoonId' | 'viewCount' | 'likeCount' | 'createdAt' | 'publishedAt'>
