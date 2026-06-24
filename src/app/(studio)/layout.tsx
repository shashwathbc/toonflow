import StudioSidebar from '@/components/layout/StudioSidebar'

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex">
      <StudioSidebar />
      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
