'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Root Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-danger" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-text">Something went wrong</h1>
        <p className="text-sm text-text-secondary">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="btn-accent gap-2 mx-auto"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  )
}
