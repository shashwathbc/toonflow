import Skeleton from '@/components/ui/Skeleton'

export default function AuthLoading() {
  return (
    <div className="w-full max-w-sm space-y-4 animate-fade-in" aria-hidden="true">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  )
}
