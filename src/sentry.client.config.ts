// Sentry client-side configuration — runs in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://examplePublicKey@o0.ingest.sentry.io/0',

  // Performance tracing sample rate:
  // - Production: sample 25% of transactions (balance of cost vs insight)
  // - Dev: sample 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  // Don't send PII to Sentry.
  sendDefaultPii: false,

  // Disable in test environment.
  enabled: process.env.NODE_ENV !== 'test',
})
