'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { getUserProfile, createUserDocument } from '@/lib/firebase/firestore'
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

async function setSessionCookie(
  idToken: string,
  role: string,
  email: string
): Promise<void> {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, role, email }),
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Never let document-creation or profile-fetch errors block auth from resolving
        try { await createUserDocument(firebaseUser) } catch (e) {
          console.error('[Auth] createUserDocument error:', e)
        }

        let profile: UserProfile | null = null
        let idToken = ''
        try {
          ;[profile, idToken] = await Promise.all([
            getUserProfile(firebaseUser.uid),
            firebaseUser.getIdToken(),
          ])
        } catch (e) {
          console.error('[Auth] profile/token fetch error:', e)
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

        if (idToken) {
          await setSessionCookie(
            idToken,
            isSuperAdmin ? 'superadmin' : (profile?.role ?? 'user'),
            firebaseUser.email ?? ''
          ).catch((e) => console.error('[Auth] session cookie error:', e))
        }
      } else {
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
