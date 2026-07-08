import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import PwaRegister from '@/components/pwa/PwaRegister'
import { TooltipProvider } from '@/components/ui/Tooltip'

export const metadata: Metadata = {
  title: {
    default: 'Toonflow Studio Paint',
    template: '%s | Toonflow Studio Paint',
  },
  description: 'The professional platform for reading, discovering, and creating webtoons and manga.',
  keywords: ['webtoon', 'manga', 'manhwa', 'comics', 'creator', 'studio', 'originals'],
  authors: [{ name: 'Toonflow Studio Paint' }],
  creator: 'Toonflow Studio Paint',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://toonflowstudiopaint.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Toonflow Studio Paint',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Toonflow Studio Paint' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
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
          </TooltipProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: '1px solid #272727',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#00C896', secondary: '#0F0F0F' },
              },
              error: {
                iconTheme: { primary: '#FF4444', secondary: '#FFFFFF' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
