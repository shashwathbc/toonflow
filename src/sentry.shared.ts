// Shared Sentry DSN resolution + enable gate for the client / server / edge
// configs. The example DSN is committed as a placeholder in apphosting.yaml and
// ci.yml, so without this guard all three runtimes would initialise Sentry
// against a fake project and fail transport silently (audit finding M4). Treat a
// missing OR placeholder DSN as "not configured": pass no DSN and disable init.
const PLACEHOLDER_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0'

const raw = process.env.NEXT_PUBLIC_SENTRY_DSN

/** The real DSN, or undefined when unset / still the committed placeholder. */
export const SENTRY_DSN = raw && raw !== PLACEHOLDER_DSN ? raw : undefined

/** Sentry runs only with a real DSN, and never under tests. */
export const SENTRY_ENABLED = Boolean(SENTRY_DSN) && process.env.NODE_ENV !== 'test'

// Make the "no real DSN → tracking disabled" state visible in server/edge logs
// (not the browser console) instead of silently initialising the placeholder.
// Fires once per runtime, on import.
if (!SENTRY_DSN && process.env.NODE_ENV !== 'test' && typeof window === 'undefined') {
  console.warn(
    '[Sentry] NEXT_PUBLIC_SENTRY_DSN is unset or still the example placeholder — error tracking is DISABLED. Set the real DSN secret in Secret Manager to enable it.',
  )
}
