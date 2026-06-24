import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
  'aria-label'?: string
}

export default function Skeleton({ className, 'aria-label': ariaLabel }: SkeletonProps) {
  return (
    <div
      className={cn('shimmer rounded-lg', className)}
      role="status"
      aria-label={ariaLabel ?? 'Loading…'}
      aria-live="polite"
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-0 overflow-hidden" role="status" aria-label="Loading content…">
      <Skeleton className="aspect-[2/3] w-full rounded-b-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[480px]" role="status" aria-label="Loading hero…">
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  )
}
