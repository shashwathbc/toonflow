import type { FirestoreTimestamp } from './user'
import type { ContentStatus, ContentGenre } from './novel'

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
  status: 'draft' | 'published'
  createdAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

export type WebtoonCreateInput = Omit<
  Webtoon,
  'id' | 'authorId' | 'authorName' | 'authorPhotoURL' | 'viewCount' | 'likeCount' |
  'bookmarkCount' | 'episodeCount' | 'rating' | 'ratingCount' | 'createdAt' | 'updatedAt' | 'publishedAt'
>

export type EpisodeCreateInput = Omit<Episode, 'id' | 'webtoonId' | 'viewCount' | 'createdAt' | 'publishedAt'>
