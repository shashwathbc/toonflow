/**
 * A `permission-denied` from a realtime Firestore listener is an EXPECTED, benign
 * condition for our optional, best-effort UI (the navbar notification bell + unread
 * message badge, message threads). It happens when:
 *   - the rules for that collection haven't been deployed yet, or
 *   - a listener briefly stays attached across sign-out, or
 *   - the auth token hasn't propagated to Firestore the instant the listener attaches.
 *
 * In none of these cases is there anything the user can do — the feature simply
 * shows empty. Surfacing it via `console.error` would pop the Next.js dev error
 * overlay on top of the whole app (see the "Console FirebaseError" overlay), which
 * is noise. So we swallow that one code and only log genuinely unexpected failures.
 */
export function isPermissionDenied(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    (e as { code?: string }).code === 'permission-denied'
  )
}

/**
 * Log a realtime-listener error unless it's a benign permission-denied (see above).
 * Keeps real bugs visible in the console while not hampering the user with an error
 * overlay for a feature that just isn't available to them yet.
 */
export function logListenerError(scope: string, e: unknown): void {
  if (isPermissionDenied(e)) return
  console.error(`${scope} listener error:`, e)
}
