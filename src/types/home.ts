import type { FirestoreTimestamp } from './user'
import type { ContentStatus } from './novel'

/**
 * Flattened catalog entry for the home page's hero + card rows.
 *
 * The home feed is server-rendered, so every field here crosses the RSC
 * boundary as JSON. A full `Novel`/`Webtoon` doc carries ~25 fields the cards
 * never read (tags, language, authorPhotoURL, like/bookmark counts, premium
 * flags…) and non-serializable Firestore `Timestamp` instances — at ~30 items
 * per page that is dead weight in the flight payload on every load. This is the
 * exact set the hero and the cards render, nothing more.
 *
 * `type` is folded into the item so rows are plain arrays instead of
 * `{ item, type }` tuples, and `partCount` unifies chapterCount/episodeCount.
 */
export interface HomeItem {
  id: string
  type: 'novel' | 'webtoon' | 'anime'
  title: string
  synopsis: string
  coverURL: string | null
  bannerURL: string | null
  status: ContentStatus
  genres: string[]
  viewCount: number
  rating: number
  /** chapterCount for novels, episodeCount for webtoons, sceneCount for anime */
  partCount: number
  publishedAt: FirestoreTimestamp | null
  createdAt: FirestoreTimestamp | null
}

/** Everything the home page renders, resolved in one server pass. */
export interface HomeFeedData {
  trending: HomeItem[]
  newReleases: HomeItem[]
  novels: HomeItem[]
  webtoons: HomeItem[]
  anime: HomeItem[]
}
