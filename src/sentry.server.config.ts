// Sentry server-side configuration — runs in the Node.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DSN, SENTRY_ENABLED } from './sentry.shared'

Sentry.init({
  dsn: SENTRY_DSN,

  // Sample rate — 1.0 = capture 100% of server errors.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  // Don't send PII from server context.
  sendDefaultPii: false,

  // Off under tests and when no real DSN is configured (see sentry.shared).
  enabled: SENTRY_ENABLED,
})
