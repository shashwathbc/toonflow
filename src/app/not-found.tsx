import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist or has been moved.',
  // A 404 must never be indexed, even though Next also sends a 404 status.
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-8xl font-bold text-bg-border" aria-label="404">404</h1>
      <h2 className="text-2xl font-bold text-text mt-4">Page Not Found</h2>
      <p className="text-text-secondary mt-2 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex items-center gap-3 mt-8">
        <Link href="/" className="btn-accent">
          <Home size={16} aria-hidden="true" />
          Go Home
        </Link>
        <Link href="/browse" className="btn-ghost">
          <Search size={16} aria-hidden="true" />
          Browse Content
        </Link>
      </div>
    </div>
  )
}
