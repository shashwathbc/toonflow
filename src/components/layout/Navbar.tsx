'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils/cn'
import UserMenu from './UserMenu'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/originals', label: 'Originals' },
  { href: '/browse', label: 'Browse' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const { setMobileNavOpen, setLoginModalOpen } = useAppStore()

  const handleCreate = () => {
    if (!isAuthenticated) {
      setLoginModalOpen(true)
      return
    }
  }

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
          className="flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          aria-label="Toonflow Studio Paint — home"
        >
          <span className="text-base font-bold text-text tracking-tight hidden sm:block">
            TOONFLOW<span className="text-accent"> STUDIO PAINT</span>
          </span>
          <span className="text-base font-bold text-accent sm:hidden">TF</span>
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
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Create button */}
          {isAuthenticated ? (
            <Link
              href="/create"
              className="btn-accent text-sm py-1.5 px-3"
              aria-label="Create new content"
            >
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:block">CREATE</span>
            </Link>
          ) : (
            <button
              onClick={handleCreate}
              className="btn-accent text-sm py-1.5 px-3"
              aria-label="Create — sign in required"
            >
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:block">CREATE</span>
            </button>
          )}

          {/* Search */}
          <Link
            href="/browse"
            className="btn-ghost p-2 rounded-lg"
            aria-label="Search content"
          >
            <Search size={18} aria-hidden="true" />
          </Link>

          {/* User menu or auth buttons */}
          <UserMenu />

          {/* Mobile nav toggle */}
          <button
            className="btn-ghost p-2 rounded-lg md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded="false"
            aria-controls="mobile-nav"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  )
}
