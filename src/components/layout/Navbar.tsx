'use client'

import { memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search, MessagesSquare } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadCount } from '@/hooks/useUnreadCount'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import { Logo } from '@/components/ui/Logo'
import UserMenu from './UserMenu'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/originals', label: 'Originals' },
  { href: '/browse', label: 'Browse' },
]

function Navbar() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const unread = useUnreadCount()
  const messagesActive = pathname.startsWith('/messages')

  return (
    <header
      className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-bg-border"
      role="banner"
    >
      <nav
        className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          aria-label="Toonflow Studio Paint — home"
        >
          <Logo size="md" priority />
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isActive
                      ? 'bg-bg-elevated text-text'
                      : 'text-text-secondary hover:text-text'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              </li>
            )
          })}

          {/* Messages — next to Browse, with a live unread badge */}
          {isAuthenticated && (
            <li>
              <Link
                href="/messages"
                aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
                aria-current={messagesActive ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  messagesActive ? 'bg-bg-elevated text-text' : 'text-text-secondary hover:text-text'
                )}
              >
                <MessagesSquare size={16} aria-hidden="true" />
                Messages
                {unread > 0 && (
                  <span
                    className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
                    aria-hidden="true"
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            </li>
          )}
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Create button */}
          {isAuthenticated ? (
            <Link
              href="/create"
              className="hidden md:inline-flex btn-accent text-sm py-1.5 px-3"
              aria-label="Create new content"
            >
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:block">CREATE</span>
            </Link>
          ) : (
            <Link
              href="/login?redirect=/create"
              className="hidden md:inline-flex btn-accent text-sm py-1.5 px-3"
              aria-label="Create — sign in required"
            >
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:block">CREATE</span>
            </Link>
          )}

          {/* Search */}
          <Tooltip label="Search">
            <Link
              href="/browse"
              className="btn-ghost p-2 rounded-lg"
              aria-label="Search content"
            >
              <Search size={18} aria-hidden="true" />
            </Link>
          </Tooltip>

          {/* User menu or auth buttons */}
          <div className="hidden md:block">
            <UserMenu />
          </div>
        </div>
      </nav>
    </header>
  )
}

export default memo(Navbar)
