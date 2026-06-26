import Skeleton, { HeroSkeleton, CardSkeleton } from '@/components/ui/Skeleton'

export default function MainLoading() {
  return (
    <div className="space-y-16 animate-fade-in">
      <HeroSkeleton />

      <section className="max-w-screen-xl mx-auto px-4" aria-hidden="true">
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section className="max-w-screen-xl mx-auto px-4 mb-16" aria-hidden="true">
        <div className="card-elevated p-8 rounded-2xl">
          <Skeleton className="h-6 w-48 mb-3" />
          <Skeleton className="h-4 w-72 mb-6" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </section>
    </div>
  )
}
