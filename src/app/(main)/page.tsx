import type { Metadata } from 'next'
import { HeroSlider } from '@/components/home/HeroSlider'
import { HomeFeed } from './HomeFeed'

export const metadata: Metadata = {
  // `absolute` bypasses the root `%s | Toonflow Studio Paint` template. This is
  // the site root, so the brand + tagline IS the title — running it through the
  // template produced "Home — Toonflow Studio Paint | Toonflow Studio Paint".
  title: { absolute: 'Toonflow Studio Paint — Webtoons, Manga & Novels' },
  description: 'Read the latest webtoons, manga, and novels from creators around the world.',
}

export default function HomePage() {
  return (
    <div className="space-y-0">
      <HeroSlider />
      <HomeFeed />
    </div>
  )
}
