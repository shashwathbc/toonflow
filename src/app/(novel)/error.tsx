'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[Studio Error]', error)
  }, [error])

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-danger" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-text">Something went wrong</h1>
        <p className="text-sm text-text-secondary">
          The editor failed to load. Your saved work is safe.
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button type="button" onClick={reset} className="btn-accent text-sm gap-2">
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
          <button type="button" onClick={() => router.push('/create')} className="btn-ghost text-sm gap-2">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Hub
          </button>
        </div>
      </div>
    </div>
  )
}
