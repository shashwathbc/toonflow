import type { Metadata } from 'next'
import MangaGrid from '@/components/manga/MangaGrid'
import { getTopManga } from '@/lib/mangadex/client'

export const metadata: Metadata = {
  title: 'Top Webtoons & Manga',
  description:
    'Read the 30 most-followed webtoons on MangaDex, with every chapter in reading order.',
  alternates: { canonical: '/manga' },
}

// Ranking and chapter data change slowly; one hour of ISR keeps the list warm
// without hammering the MangaDex API.
export const revalidate = 3600

export default async function MangaIndexPage() {
  const manga = await getTopManga(30).catch((err) => {
    console.error('[manga] top list failed:', err)
    return []
  })

  return (
    <div className="py-2">
      <MangaGrid
        id="top-manga-heading"
        title="Top 30 Webtoons"
        description="The most-followed webtoons on MangaDex, refreshed hourly."
        manga={manga}
      />
      <p className="max-w-screen-xl mx-auto px-4 pb-10 text-xs text-white/30">
        Series data and chapter pages are provided by MangaDex. All rights belong to their
        respective creators and publishers.
      </p>
    </div>
  )
}
