// Firebase Admin SDK — SERVER ONLY. Never import from client components.
// Credentials come from FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

let app: App | null = null

function getAdminApp(): App {
  if (app) return app
  const existing = getApps()
  if (existing.length > 0) {
    app = existing[0]
    return app
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // .env files escape newlines in the PEM block
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
    )
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  return app
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}
