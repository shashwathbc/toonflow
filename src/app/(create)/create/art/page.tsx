import type { Metadata } from 'next'
import ArtStudioHome from '@/components/create/art/ArtStudioHome'
import { isFulfillmentConfigured } from '@/lib/art/fulfillment'

export const metadata: Metadata = {
  title: 'Art Studio — Create. Design. Publish. Sell.',
  description:
    'Create and publish your artwork, clothing designs, caps, posters, merchandise, and other creative products.',
  robots: { index: false, follow: false },
}

export default function ArtStudioPage() {
  // Whether physical orders can actually be fulfilled is server-side config.
  // Passing it down keeps the UI honest about what a listing can do today.
  return <ArtStudioHome fulfillmentConnected={isFulfillmentConfigured()} />
}
