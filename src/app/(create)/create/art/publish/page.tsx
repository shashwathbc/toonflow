import type { Metadata } from 'next'
import { Suspense } from 'react'
import PublishFlow from '@/components/create/art/PublishFlow'
import Skeleton from '@/components/ui/Skeleton'
import { isFulfillmentConfigured } from '@/lib/art/fulfillment'

export const metadata: Metadata = {
  title: 'Publish & sell — Art Studio',
  robots: { index: false, follow: false },
}

export default function ArtPublishPage() {
  return (
    // PublishFlow reads ?artworkId with useSearchParams, which needs a Suspense
    // boundary or the whole route opts out of static rendering.
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-10 sm:px-6">
          <Skeleton className="h-9 w-56" aria-label="Loading publish flow…" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <PublishFlow fulfillmentConnected={isFulfillmentConfigured()} />
    </Suspense>
  )
}
