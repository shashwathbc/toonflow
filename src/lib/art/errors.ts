// Turn a Firebase error into something a creator can act on.
//
// The Art Studio used to answer every failure with "Could not create that
// canvas", which tells the user nothing and tells whoever debugs it less. The
// most common failure in practice is `permission-denied` — the /artworks rules
// live in firestore.rules but have not been deployed to the project — and that
// is a deploy problem with a one-line fix, not a mystery worth guessing at.

/** Firebase errors carry a stable string `code`; nothing else here relies on it. */
function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export interface ArtErrorMessage {
  /** Shown in the toast. */
  message: string
  /**
   * True when the cause is configuration rather than anything the creator did.
   * The caller uses this to log loudly — a creator retrying will never fix it.
   */
  operational: boolean
}

export function describeArtError(error: unknown, action: string): ArtErrorMessage {
  switch (errorCode(error)) {
    case 'permission-denied':
      return {
        // Deliberately specific. A creator who reports this verbatim has told
        // us exactly which deploy is missing.
        message: `${action} was blocked by security rules. The Art Studio rules may not be deployed yet — please contact support.`,
        operational: true,
      }
    case 'unauthenticated':
      return { message: 'Your session expired. Please sign in again.', operational: false }
    case 'unavailable':
    case 'deadline-exceeded':
      return { message: "Couldn't reach the server. Check your connection and try again.", operational: false }
    case 'resource-exhausted':
      return { message: "You've hit a usage limit. Please try again in a few minutes.", operational: false }
    case 'failed-precondition':
      return {
        message: `${action} failed — a required database index is still building. Try again shortly.`,
        operational: true,
      }
    default:
      return { message: `${action} failed. Please try again.`, operational: false }
  }
}
