// Next.js instrumentation hook — registers Sentry SDK for server and Edge
// runtimes before the app handles any request.
//
// Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Automatically capture unhandled errors from Server Components,
// API route handlers, and Server Actions.
// `tsc` confirms the type exists in @sentry/nextjs v10.
export const onRequestError = Sentry.captureRequestError
