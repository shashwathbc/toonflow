export type UserRole = 'user' | 'creator' | 'admin' | 'superadmin'

export interface FirestoreTimestamp {
  seconds: number
  nanoseconds: number
}

export interface SocialLinks {
  twitter?: string
  instagram?: string
  patreon?: string
  website?: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  bannerURL?: string | null
  role: UserRole
  isCreator: boolean
  bio?: string
  socialLinks?: SocialLinks
  followerCount: number
  followingCount: number
  totalViews: number
  totalEarnings: number
  balance: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export interface BookmarkItem {
  id: string
  contentId: string
  contentType: 'novel' | 'webtoon'
  addedAt: FirestoreTimestamp
}

export interface ReadingHistoryItem {
  id: string
  contentId: string
  contentType: 'novel' | 'webtoon'
  lastChapterId: string
  lastChapterNumber: number
  lastRead: FirestoreTimestamp
}

export interface FollowRecord {
  followerId: string
  followingId: string
  createdAt: FirestoreTimestamp
}
