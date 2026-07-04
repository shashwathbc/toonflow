'use client'

import { Star } from 'lucide-react'
import ResponsiveSidebarShell from '@/components/layout/ResponsiveSidebarShell'
import SuperAdminSidebar from './SuperAdminSidebar'

export default function SuperAdminLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <ResponsiveSidebarShell
      brand={
        <span className="flex items-center gap-2 text-sm font-bold text-text tracking-wide">
          <Star size={15} className="text-warning" aria-hidden="true" />
          SUPER ADMIN
        </span>
      }
      menuLabel="Open super admin menu"
      drawerId="super-admin-drawer"
      drawerLabel="Super admin navigation menu"
      renderSidebar={(controls) => (
        <SuperAdminSidebar onClose={controls?.onClose} onNavigate={controls?.onNavigate} />
      )}
    >
      {children}
    </ResponsiveSidebarShell>
  )
}
