import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type UserCredential,
} from 'firebase/auth'
import { auth } from './config'
import { createUserDocument } from './firestore'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const githubProvider = new GithubAuthProvider()

export async function signInWithGoogle(): Promise<UserCredential> {
  const result = await signInWithPopup(auth, googleProvider)
  await createUserDocument(result.user)
  return result
}

export async function signInWithGithub(): Promise<UserCredential> {
  const result = await signInWithPopup(auth, githubProvider)
  await createUserDocument(result.user)
  return result
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const result = await signInWithEmailAndPassword(auth, email, password)
  await createUserDocument(result.user)
  return result
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(result.user, { displayName })
  await createUserDocument(result.user, { displayName })
  return result
}

export async function logout(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE' })
  return signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email)
}
