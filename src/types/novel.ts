import type { FirestoreTimestamp } from './user'

export type ContentStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'hiatus'
export type ContentVisibility = 'public' | 'private'

export type ContentGenre =
  | 'action'
  | 'adventure'
  | 'romance'
  | 'fantasy'
  | 'horror'
  | 'comedy'
  | 'thriller'
  | 'mystery'
  | 'sci-fi'
  | 'slice-of-life'
  | 'historical'
  | 'isekai'
  | 'wuxia'
  | 'drama'
  | 'psychological'

export interface Novel {
  id: string
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  title: string
  slug: string
  synopsis: string
  coverURL: string | null
  bannerURL: string | null
  status: ContentStatus
  genres: ContentGenre[]
  tags: string[]
  language: string
  visibility: ContentVisibility
  isPremium: boolean
  isFeatured: boolean
  isOriginal: boolean
  viewCount: number
  likeCount: number
  bookmarkCount: number
  chapterCount: number
  rating: number
  ratingCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

export interface Chapter {
  id: string
  novelId: string
  title: string
  chapterNumber: number
  content: string
  wordCount: number
  isPremium: boolean
  coinCost: number
  viewCount: number
  status: 'draft' | 'published'
  createdAt: FirestoreTimestamp
  publishedAt: FirestoreTimestamp | null
}

export type NovelCreateInput = Omit<
  Novel,
  'id' | 'authorId' | 'authorName' | 'authorPhotoURL' | 'viewCount' | 'likeCount' |
  'bookmarkCount' | 'chapterCount' | 'rating' | 'ratingCount' | 'createdAt' | 'updatedAt' | 'publishedAt'
> & { status: ContentStatus }

export type ChapterCreateInput = Omit<Chapter, 'id' | 'novelId' | 'viewCount' | 'createdAt' | 'publishedAt'>
