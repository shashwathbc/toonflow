import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

const PLATFORM_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/originals', label: 'Originals' },
  { href: '/browse', label: 'Browse' },
  { href: '/profile', label: 'Profile' },
]

const SUPPORT_LINKS = [
  { href: '/support/faq', label: 'Ask a Question' },
  { href: '/support/report', label: 'Report an Issue' },
]

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/ai-policy', label: 'AI Policy' },
]

export default function Footer() {
  return (
    <footer
      className="bg-bg border-t border-bg-border mt-16"
      role="contentinfo"
      aria-label="Site footer"
    >
      {/* Main footer */}
      <div className="max-w-screen-xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label="Toonflow Studio Paint — home"
          >
            <span className="text-sm font-bold text-text tracking-widest uppercase">
              TOONFLOW<span className="text-accent"> STUDIO PAINT</span>
            </span>
          </Link>
          <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
            A premium platform for reading, discovering, and creating webtoons and manga.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent transition-colors p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              aria-label="Follow Toonflow on Instagram (opens in new tab)"
            >
              <ExternalLink size={18} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Platform */}
        <nav aria-label="Platform links">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-3">
            Platform
          </h3>
          <ul className="space-y-2" role="list">
            {PLATFORM_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-text-secondary hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Support */}
        <nav aria-label="Support links">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-3">
            Support
          </h3>
          <ul className="space-y-2" role="list">
            {SUPPORT_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-text-secondary hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Connect */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-3">
            Connect
          </h3>
          <p className="text-xs font-semibold text-text-muted uppercase mb-2">
            Media &amp; Business
          </p>
          <a
            href="mailto:toonflowstudiopaint@gmail.com"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            toonflowstudiopaint@gmail.com
          </a>
          <div className="mt-4 border border-bg-border rounded-lg px-3 py-2 text-xs text-text-muted flex items-center gap-2">
            <span aria-hidden="true">🛡</span>
            Secure &amp; Protected Creator Hub
          </div>
        </div>
      </div>

      {/* Content policy */}
      <div className="border-t border-bg-border">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-muted text-center sm:text-left">
            <span className="font-semibold text-text-secondary">Content Policy</span>{' '}
            Toonflow does not host, store, or proxy any third-party manga content. All external
            titles are metadata-only previews. Toonflow Originals are owned by their respective creators.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-bg-border">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} TOONFLOW STUDIO PAINT. ALL RIGHTS RESERVED.
          </p>
          <nav aria-label="Legal links">
            <ul className="flex items-center gap-4" role="list">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-xs text-text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
