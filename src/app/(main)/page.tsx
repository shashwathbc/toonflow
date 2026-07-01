import type { Metadata } from 'next'
import { HeroSlider } from '@/components/home/HeroSlider'
import { HomeFeed } from './HomeFeed'

export const metadata: Metadata = {
  title: 'Home — Toonflow Studio Paint',
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
