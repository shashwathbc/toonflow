'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  ChevronLeft,
  Clapperboard,
  ImageIcon,
  Lock,
  Palette,
  Store,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils/cn'

/**
 * Chrome for every page under /create/anime, /create/art, /create/novel and
 * /create/webtoon.
 *
 * Deliberately NOT the (studio) sidebar: that shell belongs to Dashboard/Wallet
 * and would drag their nav back into the Create section, which is exactly what
 * this redesign removes. The Create section navigates between the four studios
 * and back to the hub — nothing else.
 */
type Tint = 'anime' | 'art' | 'novel' | 'webtoon'

/**
 * Active-tab tint per studio.
 *
 * Written out as complete literals rather than composed strings — Tailwind scans
 * source text, so `bg-studio-${tint}/12` would never make it into the stylesheet.
 */
const ACTIVE_TINT: Record<Tint, string> = {
  anime: 'bg-studio-anime/12 text-studio-anime',
  art: 'bg-studio-art/12 text-studio-art',
  novel: 'bg-studio-novel/12 text-studio-novel',
  webtoon: 'bg-studio-webtoon/12 text-studio-webtoon',
}

interface StudioTab {
  href: string
  /** Accessible name — used as the aria-label on every breakpoint. */
  label: string
  /** Shortened visual label; the icon stands alone below `sm`. */
  short: string
  icon: typeof Clapperboard
  tint: Tint
}

const STUDIOS: StudioTab[] = [
  { href: '/create/anime', label: 'Anime Studio', short: 'Anime', icon: Clapperboard, tint: 'anime' },
  { href: '/create/art', label: 'Art Studio', short: 'Art', icon: Palette, tint: 'art' },
  { href: '/create/novel', label: 'Novel Studio', short: 'Novel', icon: BookOpen, tint: 'novel' },
  { href: '/create/webtoon', label: 'Webtoon Studio', short: 'Webtoon', icon: ImageIcon, tint: 'webtoon' },
]

/**
 * Routes that take over the whole viewport — no shell chrome, no page scroll.
 *
 * The two canvas editors live at the studio's *detail* route rather than under
 * an `/editor/` segment (`/create/webtoon/{id}` is the infinite canvas and
 * `/create/novel/{id}` is the chapter editor), so matching on `/editor/` alone
 * would leave a header floating over them. /create/seed is a self-contained
 * seeding tool that already ships its own <main> and back link.
 */
const IMMERSIVE_PATTERNS = [
  /\/editor\//,
  /^\/create\/(?:novel|webtoon)\/[^/]+/,
  /^\/create\/seed/,
]

export default function CreateStudioShell({
  children,
  canUseWebtoon = true,
}: {
  children: React.ReactNode
  /** False when the signed-in email isn't on the Webtoon Studio allow-list. */
  canUseWebtoon?: boolean
}) {
  const pathname = usePathname()

  const isImmersive = IMMERSIVE_PATTERNS.some((pattern) => pattern.test(pathname))

  if (isImmersive) return <>{children}</>

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header
        className="sticky top-0 z-40 border-b border-bg-border bg-bg/90 backdrop-blur-md"
        role="banner"
      >
        <nav
          className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 sm:gap-4 sm:px-6"
          aria-label="Create studio navigation"
        >
          <Link
            href="/create"
            className="flex shrink-0 items-center gap-1.5 rounded-lg text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Back to the Create hub"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span className="hidden lg:block">
              <Logo size="sm" variant="studio" />
            </span>
            <span className="text-sm font-semibold lg:hidden">Create</span>
          </Link>

          {/* Four tabs never fit a narrow viewport at full width, so the strip
              scrolls rather than wrapping the header to two rows. */}
          <ul
            className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none"
            role="list"
          >
            {STUDIOS.map(({ href, label, short, icon: Icon, tint }) => {
              const isActive = pathname.startsWith(href)
              const locked = tint === 'webtoon' && !canUseWebtoon

              // A locked studio still holds its place in the row — the tab set
              // reads as the same four studios as the hub — but it is inert
              // rather than a link that the proxy would bounce straight back.
              if (locked) {
                return (
                  <li key={href}>
                    <span
                      className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-text-muted"
                      aria-label={`${label} — launching soon`}
                    >
                      <Lock size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">{short}</span>
                    </span>
                  </li>
                )
              }

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    // The label is the accessible name on every size; only its
                    // visual presentation collapses on narrow screens.
                    aria-label={label}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      isActive
                        ? ACTIVE_TINT[tint]
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text',
                    )}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">{short}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <Link
            href="/marketplace"
            className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:flex"
          >
            <Store size={16} aria-hidden="true" />
            Marketplace
          </Link>
        </nav>
      </header>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
