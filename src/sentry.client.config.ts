// Sentry client-side configuration — runs in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DSN, SENTRY_ENABLED } from './sentry.shared'

Sentry.init({
  dsn: SENTRY_DSN,

  // Performance tracing sample rate:
  // - Production: sample 25% of transactions (balance of cost vs insight)
  // - Dev: sample 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  // Don't send PII to Sentry.
  sendDefaultPii: false,

  // Off under tests and when no real DSN is configured (see sentry.shared).
  enabled: SENTRY_ENABLED,
})
