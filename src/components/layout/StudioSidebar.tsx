'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  ImageIcon,
  LayoutDashboard,
  Wallet,
  Shield,
  Star,
  ChevronLeft,
  Home,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

interface SidebarItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  superAdminOnly?: boolean
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { href: '/create/novel', label: 'Novel Studio', icon: <BookOpen size={18} /> },
  { href: '/create/webtoon', label: 'Webtoon Studio', icon: <ImageIcon size={18} /> },
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/wallet', label: 'Wallet', icon: <Wallet size={18} /> },
  { href: '/admin', label: 'Admin Panel', icon: <Shield size={18} />, adminOnly: true },
  { href: '/admin/super', label: 'Super Admin', icon: <Star size={18} />, superAdminOnly: true },
]

export default function StudioSidebar() {
  const pathname = usePathname()
  const { isAdmin, isSuperAdmin } = useAuth()

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin
    if (item.adminOnly) return isAdmin
    return true
  })

  return (
    <aside
      className="w-56 shrink-0 border-r border-bg-border flex flex-col bg-bg-card min-h-screen"
      aria-label="Studio navigation"
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-bg-border">
        <span className="text-sm font-bold text-text">
          TOONFLOW <span className="text-accent">STUDIO</span>
        </span>
      </div>

      {/* Back to site */}
      <div className="px-3 pt-3">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-text-muted hover:text-text',
            'hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
          )}
          aria-label="Back to main site"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <Home size={14} aria-hidden="true" />
          Back to site
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2" aria-label="Studio tools">
        <ul className="space-y-1" role="list">
          {visibleItems.map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
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
        </ul>
      </nav>
    </aside>
  )
}
