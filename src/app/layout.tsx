import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import PwaRegister from '@/components/pwa/PwaRegister'
import { TooltipProvider } from '@/components/ui/Tooltip'
import TourManager from '@/components/tour/TourManager'
import JsonLd from '@/components/seo/JsonLd'
import { organizationSchema, websiteSchema } from '@/lib/seo/schema'
import { APP_NAME, APP_URL, SOCIAL_HANDLE } from '@/lib/utils/constants'

const APP_DESCRIPTION =
  'The professional platform for reading, discovering, and creating webtoons, manga, and novels.'

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['webtoon', 'manga', 'manhwa', 'novels', 'comics', 'creator', 'studio', 'originals'],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  // APP_URL already resolves NEXT_PUBLIC_APP_URL with the same fallback —
  // importing it keeps one source of truth instead of two copies of the literal.
  metadataBase: new URL(APP_URL),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    site: SOCIAL_HANDLE,
    creator: SOCIAL_HANDLE,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  manifest: '/manifest.json',
  // Google Search Console verification. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  // to the token from the "HTML tag" verification method — Next emits the
  // <meta name="google-site-verification"> tag. Left unset, no tag is emitted.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  // NOTE: no `icons` key on purpose. Icons come from the App Router file
  // conventions — src/app/icon.png, apple-icon.png, opengraph-image.png,
  // twitter-image.png (plus favicon.ico). Next content-hashes those URLs, so
  // they cache-bust themselves on every change. Declaring `icons` here as well
  // would emit a second, competing set of <link rel="icon"> tags pointing at
  // unhashed paths. Regenerate them all with `npm run icons`.
}

export const viewport: Viewport = {
  themeColor: '#0F0F0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body>
        {/* Site-wide structured data: brand entity + sitelinks search box.
            Server-rendered so it's in the raw HTML for every crawl. */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        {/* WCAG 2.4.1: Skip navigation */}
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <PwaRegister />
        <AuthProvider>
          {/* delayDuration: ~200ms open delay to prevent flicker.
              skipDelayDuration: move between adjacent tooltips (toolbars) without re-waiting. */}
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
            {/* First-run interactive product tour — auto-starts once per new user
                on whatever page they land on; replayable from the account menu. */}
            <TourManager />
          </TooltipProvider>
          <Toaster
            position="bottom-right"
            // react-hot-toast renders into a portal with inline styles, so these
            // can't be Tailwind classes — but the values must still be the design
            // tokens from tailwind.config.ts, not one-offs. #00C896 here was the
            // OLD accent colour, left behind when accent became white; #272727
            // was never a token at all. Keep this table in sync with the
            // `colors` block in tailwind.config.ts.
            toastOptions={{
              style: {
                background: '#1A1A1A', // bg-card
                color: '#FFFFFF', // text
                border: '1px solid #3F3F3F', // bg-border
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#2DCA72', secondary: '#0F0F0F' }, // success / bg
              },
              error: {
                iconTheme: { primary: '#FF4444', secondary: '#FFFFFF' }, // danger / text
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
