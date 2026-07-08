'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, BookOpen, ImageIcon,
  Flag, Settings, ChevronLeft, Star, X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

const NAV = [
  { href: '/admin/super', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/super/users', label: 'Users', icon: Users },
  { href: '/admin/super/novels', label: 'Novel Studio', icon: BookOpen },
  { href: '/admin/super/webtoons', label: 'Webtoon Studio', icon: ImageIcon },
  { href: '/admin/super/requests', label: 'Requests', icon: Flag },
  { href: '/admin/super/settings', label: 'Settings', icon: Settings },
]

interface SuperAdminSidebarProps {
  /** Rendered inside the mobile drawer: shows a close button in the header. */
  onClose?: () => void
  /** Called when any nav link is clicked (used to dismiss the mobile drawer). */
  onNavigate?: () => void
}

export default function SuperAdminSidebar({ onClose, onNavigate }: SuperAdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="w-60 shrink-0 border-r border-bg-border flex flex-col bg-bg-card min-h-full h-full overflow-y-auto"
      aria-label="Super admin navigation"
      role="navigation"
    >
      {/* Branding */}
      <div className="h-14 shrink-0 flex items-center gap-2.5 px-5 border-b border-bg-border">
        <Star size={16} className="text-warning" aria-hidden="true" />
        <span className="text-sm font-bold text-text tracking-wide">SUPER ADMIN</span>
        {onClose && (
          <Tooltip label="Close menu" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="ml-auto p-1.5 -mr-2 rounded-lg text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close super admin menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Back */}
      <div className="px-3 pt-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label="Back to main site"
        >
          <ChevronLeft size={13} aria-hidden="true" />
          Back to site
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3" aria-label="Super admin sections">
        <ul className="space-y-0.5" role="list">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text hover:bg-bg-elevated'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bg-border">
        <p className="text-[11px] text-text-muted">All actions are logged.</p>
      </div>
    </aside>
  )
}
