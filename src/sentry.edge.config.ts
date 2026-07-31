// Sentry Edge runtime configuration — runs in Edge API routes.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'
import { SENTRY_DSN, SENTRY_ENABLED } from './sentry.shared'

Sentry.init({
  dsn: SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.25 : 1.0,

  sendDefaultPii: false,

  // Off under tests and when no real DSN is configured (see sentry.shared).
  enabled: SENTRY_ENABLED,
})
