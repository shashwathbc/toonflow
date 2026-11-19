import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BrowseClient } from './BrowseClient'
import { getTopManga } from '@/lib/mangadex/client'

export const metadata: Metadata = {
  title: 'Browse — Webtoons & Novels',
  description: 'Browse all webtoons, manga, and novels by genre, status, and rating.',
}

// The MangaDex tab is refreshed hourly, independently of the live Firestore
// catalog rendered by BrowseClient.
export const revalidate = 3600

export default async function BrowsePage() {
  const manga = await getTopManga(30).catch((err) => {
    console.error('[browse] top manga failed:', err)
    return []
  })

  return (
    <>
    <Suspense fallback={
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="h-8 w-32 bg-bg-elevated rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-bg-card border border-bg-border animate-pulse">
              <div className="aspect-[2/3] bg-bg-elevated" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-bg-elevated rounded w-4/5" />
                <div className="h-3 bg-bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <BrowseClient manga={manga} />
    </Suspense>
    </>
  )
}
