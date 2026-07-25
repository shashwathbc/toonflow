// Sentry server-side configuration — runs in the Node.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://examplePublicKey@o0.ingest.sentry.io/0',

  // Sample rate — 1.0 = capture 100% of server errors.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  // Don't send PII from server context.
  sendDefaultPii: false,

  enabled: process.env.NODE_ENV !== 'test',
})
