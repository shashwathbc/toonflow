'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import {
  BookOpen,
  ImageIcon,
  LayoutDashboard,
  Wallet,
  Star,
  ChevronLeft,
  Home,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canUseWebtoonStudio } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

interface SidebarItem {
  href: string
  label: string
  icon: React.ReactNode
  superAdminOnly?: boolean
  /** Hidden unless the account may use the Webtoon Studio (temporary release gate). */
  webtoonGated?: boolean
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { href: '/create/novel', label: 'Novel Studio', icon: <BookOpen size={18} /> },
  { href: '/create/webtoon', label: 'Webtoon Studio', icon: <ImageIcon size={18} />, webtoonGated: true },
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/wallet', label: 'Wallet', icon: <Wallet size={18} /> },
  { href: '/admin/super', label: 'Super Admin', icon: <Star size={18} />, superAdminOnly: true },
]

interface StudioSidebarProps {
  /** Rendered inside the mobile drawer: shows a close button in the header. */
  onClose?: () => void
  /** Called when any nav link is clicked (used to dismiss the mobile drawer). */
  onNavigate?: () => void
}

export default function StudioSidebar({ onClose, onNavigate }: StudioSidebarProps) {
  const pathname = usePathname()
  const { isSuperAdmin, firebaseUser } = useAuth()

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin
    if (item.webtoonGated) return canUseWebtoonStudio(firebaseUser?.email)
    return true
  })

  return (
    <aside
      className="w-56 shrink-0 border-r border-bg-border flex flex-col bg-bg-card min-h-full h-full overflow-y-auto"
      aria-label="Studio navigation"
    >
      {/* Logo */}
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-bg-border">
        <Logo size="sm" variant="studio" />
        {onClose && (
          <Tooltip label="Close menu" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -mr-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close studio menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Back to site */}
      <div className="px-3 pt-3">
        <Link
          href="/"
          onClick={onNavigate}
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
                  onClick={onNavigate}
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
