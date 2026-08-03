export type UserRole = 'user' | 'creator' | 'admin' | 'superadmin'

export interface FirestoreTimestamp {
  seconds: number
  nanoseconds: number
}

export interface SocialLinks {
  youtube?: string
  instagram?: string
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
  /** True once the user has finished (or skipped) the product tour — gates the
   *  first-run onboarding so it auto-starts only once. */
  hasOnboarded?: boolean
  /** Where the user first heard about Toonflow, captured on the tour's welcome
   *  screen (e.g. 'x', 'youtube', 'instagram', 'linkedin'). */
  referralSource?: string
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

/**
 * A user as shown in a Followers/Following list row: a slice of their public
 * profile plus flags describing their relationship to the *viewer* (the signed
 * in user browsing the list). `isMutual` (friends) = both follow each other,
 * which gates the Message action.
 */
export interface SocialUser
  extends Pick<
    UserProfile,
    'uid' | 'displayName' | 'photoURL' | 'bio' | 'followerCount' | 'followingCount'
  > {
  /** When this follow edge was created — drives "recently followed" ordering. */
  followedAt: FirestoreTimestamp | null
  /** Viewer follows this user. */
  viewerFollows: boolean
  /** This user follows the viewer. */
  followsViewer: boolean
  /** Both follow each other → friends → messaging allowed. */
  isMutual: boolean
}
