import Skeleton from '@/components/ui/Skeleton'

export default function StudioLoading() {
  return (
    <div className="flex flex-col h-screen bg-bg animate-fade-in" aria-hidden="true">
      {/* Toolbar skeleton */}
      <div className="h-12 border-b border-bg-border bg-bg-card flex items-center gap-3 px-4 shrink-0">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-8 rounded-lg" />
      </div>

      {/* Three-column skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 border-r border-bg-border bg-bg-card p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-6 rounded-lg" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>

        {/* Center editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-card">
          <div className="px-8 pt-6 pb-2 border-b border-bg-border">
            <Skeleton className="h-7 w-64" />
          </div>
          <div className="flex-1 px-8 py-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="pt-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        {/* Right AI panel */}
        <div className="w-64 border-l border-bg-border bg-bg-card p-4 space-y-3 shrink-0">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="pt-2 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  )
}
