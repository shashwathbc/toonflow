'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Main Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
        <AlertTriangle size={24} className="text-danger" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-text">Page failed to load</h1>
      <p className="text-sm text-text-secondary max-w-xs">
        Something went wrong while loading this page.
      </p>
      <div className="flex items-center gap-3">
        <button onClick={reset} className="btn-accent text-sm gap-2">
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
        <Link href="/" className="btn-ghost text-sm gap-2">
          <Home size={14} aria-hidden="true" />
          Home
        </Link>
      </div>
    </div>
  )
}
