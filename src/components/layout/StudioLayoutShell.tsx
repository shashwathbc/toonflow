'use client'

import { usePathname } from 'next/navigation'
import StudioSidebar from './StudioSidebar'
import ResponsiveSidebarShell from './ResponsiveSidebarShell'
import Footer from './Footer'
import MobileNav from './MobileNav'

export default function StudioLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Super admin has its own layout — bypass the studio sidebar entirely
  if (pathname.startsWith('/admin/super')) return <>{children}</>

  return (
    <ResponsiveSidebarShell
      brand={
        <span className="text-sm font-bold text-text">
          TOONFLOW <span className="text-accent">STUDIO</span>
        </span>
      }
      menuLabel="Open studio menu"
      drawerId="studio-drawer"
      drawerLabel="Studio navigation menu"
      renderSidebar={(controls) => (
        <StudioSidebar onClose={controls?.onClose} onNavigate={controls?.onNavigate} />
      )}
      footer={
        // Mobile only: keep the site footer + bottom nav bar available in the
        // studio so users landing here from the profile menu can navigate back.
        // pb-14 clears the fixed h-14 MobileNav bar; desktop studio stays clean.
        <>
          <div className="md:hidden pb-14">
            <Footer />
          </div>
          <MobileNav />
        </>
      }
    >
      {children}
    </ResponsiveSidebarShell>
  )
}
