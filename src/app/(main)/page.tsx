import type { Metadata } from 'next'
import { HeroSlider } from '@/components/home/HeroSlider'
import { HomeFeed } from './HomeFeed'
import { getHomeFeed } from '@/lib/home/homeData'

export const metadata: Metadata = {
  // `absolute` bypasses the root `%s | Toonflow Studio Paint` template. This is
  // the site root, so the brand + tagline IS the title — running it through the
  // template produced "Home — Toonflow Studio Paint | Toonflow Studio Paint".
  title: { absolute: 'Toonflow Studio Paint — Webtoons, Manga & Novels' },
  description: 'Read the latest webtoons, manga, and novels from creators around the world.',
}

// ISR. The catalog changes when a creator publishes, not per visitor, so one
// pair of Firestore queries every 5 minutes serves everyone — and, crucially,
// the HTML (including every cover <img src>) is served straight from the cache
// with no Firestore round trip in the request path at all.
export const revalidate = 300

export default async function HomePage() {
  const feed = await getHomeFeed()

  return (
    <div className="space-y-0">
      {/* Both take the same server-fetched data: the hero renders the top 5 of
          `trending`, the feed renders all four rows. Passing it down means the
          covers are in the initial HTML and start downloading immediately,
          instead of waiting for hydration + a client Firestore query. */}
      <HeroSlider initialSlides={feed.trending.slice(0, 5)} />
      <HomeFeed initialFeed={feed} />
    </div>
  )
}
