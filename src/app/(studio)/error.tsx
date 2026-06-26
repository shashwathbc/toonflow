'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Admin Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
        <AlertTriangle size={24} className="text-danger" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-bold text-text">Admin panel error</h1>
      <p className="text-sm text-text-secondary">Failed to load this admin page.</p>
      <button onClick={reset} className="btn-accent text-sm gap-2">
        <RefreshCw size={14} aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}
