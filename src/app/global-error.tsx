'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Global error boundary for the App Router.
 * Rendered by Next.js when an error bubbles past the nearest error.tsx.
 * Must define <html> and <body> tags since this replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="bg-[#0F0F0F] text-white">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-3 text-[#8B8B8B]">
              We&apos;ve been notified and are looking into it.
              Please try again.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#E5E5E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
