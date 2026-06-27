'use client'

import { usePathname } from 'next/navigation'
import StudioSidebar from './StudioSidebar'

export default function StudioLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Super admin has its own layout — bypass the studio sidebar entirely
  if (pathname.startsWith('/admin/super')) return <>{children}</>

  return (
    <div className="min-h-screen bg-bg flex">
      <StudioSidebar />
      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
