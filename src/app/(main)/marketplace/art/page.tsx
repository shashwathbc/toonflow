import type { Metadata } from 'next'
import MarketplaceFeed from '@/components/marketplace/MarketplaceFeed'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'

const TITLE = 'Anime & Manga Artwork — Marketplace'
const DESCRIPTION =
  'Original anime, manga and manhwa artwork from Toonflow creators. Illustrations, character designs, concept art and posters.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/marketplace/art' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${APP_URL}/marketplace/art`,
    siteName: APP_NAME,
  },
  twitter: { card: 'summary_large_image', site: SOCIAL_HANDLE, title: TITLE, description: DESCRIPTION },
}

export default function MarketplaceArtPage() {
  return <MarketplaceFeed initialTab="art" />
}
