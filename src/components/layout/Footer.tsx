'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { SupportType } from '@/components/support/SupportModal'
import { Logo } from '@/components/ui/Logo'
import { SUPPORT_EMAIL } from '@/lib/utils/constants'

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

// Discord's logo is a filled glyph (no recognizable outline form), so unlike the
// stroke-based icons above this one uses fill="currentColor".
function DiscordIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107 15.89 15.89 0 0 0 1.226 1.994.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z" />
    </svg>
  )
}

const PLATFORM_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/originals', label: 'Originals' },
  { href: '/browse', label: 'Browse' },
  { href: '/earnings', label: 'Creator Earnings' },
]

// Keyword-targeted AI creation landing pages. Sitewide footer links give these
// pages crawlable internal links from every public page (helps discovery + SEO).
const CREATE_LINKS = [
  { href: '/ai-novel-generator', label: 'AI Novel Generator' },
  { href: '/ai-webtoon-generator', label: 'AI Webtoon Generator' },
  { href: '/ai-manga-generator', label: 'AI Manga Generator' },
]

// Code-split: Footer renders on every (main) page, and SupportModal statically
// imports framer-motion — so a static import here put the whole animation
// library in the shared chunk for every public page, to render a closed modal.
// `type SupportType` above is a type-only import and erases at compile time.
const SupportModal = dynamic(
  () => import('@/components/support/SupportModal').then((m) => ({ default: m.SupportModal })),
  { ssr: false }
)

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
  {
    href: 'https://discord.gg/5TuFeezv8',
    label: 'Join the Toonflow Discord (opens in new tab)',
    Icon: DiscordIcon,
  },
]

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/ai-policy', label: 'AI Policy' },
]

function Footer() {
  const [supportOpen, setSupportOpen] = useState<SupportType | null>(null)
  // Latches true on first open and never resets — see the render note below.
  const [supportMounted, setSupportMounted] = useState(false)

  return (
    <footer
      // pb clears the fixed mobile bottom nav (h-14) so the copyright/legal row
      // isn't hidden behind it on phones; no offset needed on md+ (no bottom nav).
      className="bg-bg border-t border-bg-border mt-16 pb-16 md:pb-0"
      role="contentinfo"
      aria-label="Site footer"
    >
      {/* Main footer */}
      <div className="max-w-screen-xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand */}
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label="Toonflow Studio Paint — home"
          >
            <Logo size="sm" />
          </Link>
          <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
            The professional platform for reading, discovering, and creating webtoons, manga, and novels.
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

        {/* Create with AI */}
        <nav aria-label="Create with AI links">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-3">
            Create with AI
          </h3>
          <ul className="space-y-2" role="list">
            {CREATE_LINKS.map(({ href, label }) => (
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
                  onClick={() => { setSupportMounted(true); setSupportOpen(type) }}
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
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            {SUPPORT_EMAIL}
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

      {/* Not rendered until the first open, so its chunk (and framer-motion) is
          never requested for visitors who never open it. Once mounted it STAYS
          mounted — SupportModal owns the <AnimatePresence>, so unmounting it on
          close would cut off the exit animation. */}
      {supportMounted && (
        <SupportModal
          open={supportOpen !== null}
          initialType={supportOpen ?? 'question'}
          onClose={() => setSupportOpen(null)}
        />
      )}
    </footer>
  )
}

export default memo(Footer)
