'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { SupportModal, type SupportType } from '@/components/support/SupportModal'

// Brand icons — lucide-react no longer ships brand logos, so these are inline
function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function LinkedinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

const PLATFORM_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/originals', label: 'Originals' },
  { href: '/browse', label: 'Browse' },
  { href: '/earnings', label: 'Creator Earnings' },
]

const SUPPORT_ACTIONS: { type: SupportType; label: string }[] = [
  { type: 'question', label: 'Ask a Question' },
  { type: 'issue', label: 'Report an Issue' },
]

const SOCIAL_LINKS = [
  {
    href: 'https://www.instagram.com/toonflowstudiopaint/',
    label: 'Follow Toonflow on Instagram (opens in new tab)',
    Icon: InstagramIcon,
  },
  {
    href: 'https://www.linkedin.com/company/toonflow-studio-paint/',
    label: 'Follow Toonflow on LinkedIn (opens in new tab)',
    Icon: LinkedinIcon,
  },
]

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/ai-policy', label: 'AI Policy' },
]

function Footer() {
  const [supportOpen, setSupportOpen] = useState<SupportType | null>(null)

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
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-accent transition-colors p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                aria-label={label}
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
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
            {SUPPORT_ACTIONS.map(({ type, label }) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => setSupportOpen(type)}
                  className="text-sm text-text-secondary hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  {label}
                </button>
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

      <SupportModal
        open={supportOpen !== null}
        initialType={supportOpen ?? 'question'}
        onClose={() => setSupportOpen(null)}
      />
    </footer>
  )
}

export default memo(Footer)
