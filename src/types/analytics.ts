// Creator analytics payload — computed server-side by /api/creator/analytics
// from the tamper-proof chapterViews log (clients cannot query it directly).

export interface AnalyticsDay {
  /** ISO day, e.g. "2026-07-07" */
  date: string
  views: number
  /** unique readers that day */
  readers: number
  /** creator earnings attributed to that day (INR) */
  revenueInr: number
  newFollowers: number
  /** total follower count at end of that day */
  cumulativeFollowers: number
}

export interface TopStory {
  id: string
  title: string
  type: 'novel' | 'webtoon'
  views: number
  revenueInr: number
}

export interface TopChapter {
  id: string
  title: string
  parentId: string
  parentTitle: string
  type: 'chapter' | 'episode'
  views: number
}

export interface CreatorAnalytics {
  lifetimeViews: number
  todayViews: number
  weekViews: number
  monthViews: number
  followerCount: number
  uniqueReaders30d: number
  returningReaders30d: number
  avgReadTimeSec: number
  /** average max scroll depth, 0–100 */
  completionRatePct: number
  /** creator revenue-per-mille (INR per 1,000 views) */
  rpmInr: number
  /** gross cost-per-mille (INR per 1,000 views) */
  cpmInr: number
  estimatedRevenue30dInr: number
  lifetimeRevenueInr: number
  /** last 90 days, oldest first, no gaps */
  daily: AnalyticsDay[]
  topStories: TopStory[]
  topChapters: TopChapter[]
}
