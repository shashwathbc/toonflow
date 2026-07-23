import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type UserCredential,
} from 'firebase/auth'
import { auth } from './config'
import { createUserDocument } from './firestore'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// The user is already authenticated once the auth call above resolves; the
// profile-doc write is best-effort backfill. AuthContext's onIdTokenChanged
// listener also runs createUserDocument on every sign-in, so a failure here
// (e.g. Firestore blocked by an ad blocker, or a transient rules rejection)
// must never reject sign-in and strand the user on the login page.
async function ensureUserDocument(
  ...args: Parameters<typeof createUserDocument>
): Promise<void> {
  try {
    await createUserDocument(...args)
  } catch (e) {
    console.error('[Auth] createUserDocument error:', e)
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const result = await signInWithPopup(auth, googleProvider)
  await ensureUserDocument(result.user)
  return result
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const result = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserDocument(result.user)
  return result
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(result.user, { displayName })
  await ensureUserDocument(result.user, { displayName })
  return result
}

export async function logout(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE' })
  return signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email)
}
