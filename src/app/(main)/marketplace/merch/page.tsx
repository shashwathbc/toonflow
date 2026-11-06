import type { Metadata } from 'next'
import MarketplaceFeed from '@/components/marketplace/MarketplaceFeed'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'

const TITLE = 'Anime Merch — T-Shirts, Hoodies, Caps & Posters'
const DESCRIPTION =
  'Wearable anime art from Toonflow creators: T-shirts, oversized tees, hoodies, sweatshirts, caps and posters.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/marketplace/merch' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${APP_URL}/marketplace/merch`,
    siteName: APP_NAME,
  },
  twitter: { card: 'summary_large_image', site: SOCIAL_HANDLE, title: TITLE, description: DESCRIPTION },
}

export default function MarketplaceMerchPage() {
  return <MarketplaceFeed initialTab="merch" />
}
