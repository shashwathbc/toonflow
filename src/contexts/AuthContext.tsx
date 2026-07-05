'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import type { UserProfile } from '@/types'
import { SUPER_ADMIN_EMAIL } from '@/lib/utils/constants'

interface AuthState {
  firebaseUser: FirebaseUser | null
  userProfile: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  isCreator: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
}

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Firestore is imported on demand so the heavy firebase/firestore SDK
// stays out of the shared root bundle (AuthProvider wraps every page).
// Signed-out visitors never pay for it at all.
function firestoreService() {
  return import('@/lib/firebase/firestore')
}

// The server verifies the idToken and derives role/email itself — we only send
// the token. Called on every token refresh so the 7-day cookie never holds a
// stale/expired token.
async function setSessionCookie(idToken: string): Promise<void> {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    userProfile: null,
    loading: true,
    isAuthenticated: false,
    isCreator: false,
    isAdmin: false,
    isSuperAdmin: false,
  })

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) return
    const { getUserProfile } = await firestoreService()
    const profile = await getUserProfile(currentUser.uid)
    const isSuperAdmin =
      profile?.role === 'superadmin' || currentUser.email === SUPER_ADMIN_EMAIL
    setState((prev) => ({
      ...prev,
      userProfile: profile,
      isCreator: profile?.isCreator ?? false,
      isAdmin: ['admin', 'superadmin'].includes(profile?.role ?? ''),
      isSuperAdmin,
    }))
  }, [])

  // Tracks the uid whose profile is already loaded, so an hourly token refresh
  // (which also fires onIdTokenChanged) refreshes the cookie without re-fetching
  // the profile from Firestore on every tick.
  const loadedUid = useRef<string | null>(null)

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out AND token refresh — keeping the
    // verified session cookie fresh, unlike onAuthStateChanged.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Always refresh the session cookie so it never carries a stale token.
        firebaseUser
          .getIdToken()
          .then((idToken) => setSessionCookie(idToken))
          .catch((e) => console.error('[Auth] session cookie error:', e))

        // Only reload the profile when the signed-in user actually changes.
        if (loadedUid.current === firebaseUser.uid) return
        loadedUid.current = firebaseUser.uid

        const { getUserProfile, createUserDocument } = await firestoreService()

        // Never let document-creation or profile-fetch errors block auth from resolving
        try { await createUserDocument(firebaseUser) } catch (e) {
          console.error('[Auth] createUserDocument error:', e)
        }

        let profile: UserProfile | null = null
        try {
          profile = await getUserProfile(firebaseUser.uid)
        } catch (e) {
          console.error('[Auth] profile fetch error:', e)
          // Fall through — auth still resolves with firebaseUser but no profile
        }

        const isSuperAdmin =
          profile?.role === 'superadmin' || firebaseUser.email === SUPER_ADMIN_EMAIL

        setState({
          firebaseUser,
          userProfile: profile,
          loading: false,
          isAuthenticated: true,
          isCreator: profile?.isCreator ?? false,
          isAdmin: ['admin', 'superadmin'].includes(profile?.role ?? ''),
          isSuperAdmin,
        })
      } else {
        loadedUid.current = null
        setState({
          firebaseUser: null,
          userProfile: null,
          loading: false,
          isAuthenticated: false,
          isCreator: false,
          isAdmin: false,
          isSuperAdmin: false,
        })
      }
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
