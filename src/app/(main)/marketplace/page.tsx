import type { Metadata } from 'next'
import MarketplaceFeed from '@/components/marketplace/MarketplaceFeed'
import JsonLd from '@/components/seo/JsonLd'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'

const TITLE = 'Marketplace — Anime Art, T-Shirts, Hoodies & Posters'
const DESCRIPTION =
  'Browse original anime and manga artwork, T-shirts, hoodies, caps and posters designed by Toonflow creators.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/marketplace' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${APP_URL}/marketplace`,
    siteName: APP_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    site: SOCIAL_HANDLE,
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function MarketplacePage() {
  return (
    <>
      {/* CollectionPage tells search engines this is a browsable listing rather
          than a single product, which is what earns the sitelinks treatment. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: TITLE,
          description: DESCRIPTION,
          url: `${APP_URL}/marketplace`,
          isPartOf: { '@type': 'WebSite', name: APP_NAME, url: APP_URL },
        }}
      />
      <MarketplaceFeed />
    </>
  )
}
