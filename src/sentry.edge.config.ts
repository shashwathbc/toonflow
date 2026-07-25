// Sentry Edge runtime configuration — runs in Edge API routes.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://examplePublicKey@o0.ingest.sentry.io/0',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  sendDefaultPii: false,

  enabled: process.env.NODE_ENV !== 'test',
})
