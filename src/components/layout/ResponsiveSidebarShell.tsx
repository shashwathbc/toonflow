'use client'

import { useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

export interface DrawerControls {
  onClose: () => void
  onNavigate: () => void
}

interface ResponsiveSidebarShellProps {
  /** Wordmark shown in the mobile top bar. */
  brand: React.ReactNode
  /** aria-label for the hamburger button, e.g. "Open studio menu". */
  menuLabel: string
  /** DOM id linking the hamburger's aria-controls to the drawer. */
  drawerId: string
  /** aria-label for the drawer dialog. */
  drawerLabel: string
  /**
   * Renders the sidebar. Called with drawer controls for the mobile drawer
   * (wire them to a close button / link clicks) and without for desktop.
   */
  renderSidebar: (controls?: DrawerControls) => React.ReactNode
  /** Rendered after <main> — e.g. a mobile-only footer / bottom nav bar. */
  footer?: React.ReactNode
  children: React.ReactNode
}

/**
 * Sidebar layout that collapses to a hamburger-triggered slide-in drawer
 * below the `md` breakpoint. Handles backdrop, Escape, body scroll lock,
 * and focus management. Desktop sidebar is sticky at full viewport height.
 */
export default function ResponsiveSidebarShell({
  brand,
  menuLabel,
  drawerId,
  drawerLabel,
  renderSidebar,
  footer,
  children,
}: ResponsiveSidebarShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  // While the drawer is open: close on Escape, lock body scroll, move focus in.
  useEffect(() => {
    if (!menuOpen) return
    const hamburger = hamburgerRef.current
    drawerRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      hamburger?.focus()
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const controls: DrawerControls = { onClose: closeMenu, onNavigate: closeMenu }

  return (
    <div className="min-h-screen bg-bg md:flex">
      {/* Mobile top bar */}
      <header
        className="md:hidden sticky top-0 z-40 h-14 flex items-center gap-3 px-4 bg-bg-card/95 backdrop-blur-md border-b border-bg-border"
        role="banner"
      >
        <Tooltip label={menuLabel} side="bottom">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={menuLabel}
            // spread instead of an inline expression: Edge Tools' static
            // ARIA scanner can't evaluate expressions and flags them
            {...(menuOpen ? { 'aria-expanded': 'true' as const } : { 'aria-expanded': 'false' as const })}
            aria-controls={drawerId}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </Tooltip>
        {brand}
      </header>

      {/* Desktop sidebar — sticky so it stays visible while content scrolls */}
      <div className="hidden md:block sticky top-0 h-screen shrink-0">
        {renderSidebar()}
      </div>

      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden',
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile drawer — transform-only animation (GPU, no layout thrash) */}
      <div
        id={drawerId}
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={drawerLabel}
        inert={!menuOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 md:hidden outline-none',
          'transform transition-transform duration-200 ease-out will-change-transform',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {renderSidebar(controls)}
      </div>

      <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
        {children}
      </main>

      {footer}
    </div>
  )
}
