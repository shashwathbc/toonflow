'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, Home, BookOpen, Search, Plus, LayoutDashboard, Shield } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: <Home size={18} /> },
  { href: '/originals', label: 'Originals', icon: <BookOpen size={18} /> },
  { href: '/browse', label: 'Browse', icon: <Search size={18} /> },
]

export default function MobileNav() {
  const pathname = usePathname()
  const { mobileNavOpen, setMobileNavOpen } = useAppStore()
  const { isAuthenticated, isAdmin } = useAuth()

  // Close on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname, setMobileNavOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setMobileNavOpen])

  if (!mobileNavOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Drawer */}
      <nav
        id="mobile-nav"
        className="fixed inset-y-0 right-0 z-50 w-72 bg-bg-card border-l border-bg-border flex flex-col animate-slide-up"
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-bg-border">
          <span className="font-bold text-text">
            TOONFLOW <span className="text-accent">STUDIO</span>
          </span>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="btn-ghost p-2 rounded-lg"
            aria-label="Close navigation menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Nav items */}
        <ul className="flex flex-col p-3 gap-1 flex-1" role="list">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text hover:bg-bg-elevated'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              </li>
            )
          })}

          {isAuthenticated && (
            <>
              <li>
                <Link
                  href="/create"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors"
                >
                  <span aria-hidden="true"><Plus size={18} /></span>
                  Create
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors"
                >
                  <span aria-hidden="true"><LayoutDashboard size={18} /></span>
                  Dashboard
                </Link>
              </li>
            </>
          )}

          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors"
              >
                <span aria-hidden="true"><Shield size={18} /></span>
                Admin Panel
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  )
}
