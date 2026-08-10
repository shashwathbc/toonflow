'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? '/'
  // Prevent open redirect — only allow same-origin relative paths
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'

  return (
    <div className="card p-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-text">Sign in</h1>
        <p className="text-sm text-text-secondary">Welcome back to Toonflow</p>
      </div>

      <GoogleAuthButton
        redirect={redirect}
        ariaLabel="Sign in with Google"
        successMessage="Welcome!"
        errorMessage="Google sign-in failed"
      />

      <p className="text-center text-xs text-text-muted">
        Toonflow uses your Google account to sign in — there&apos;s no separate password to remember.
      </p>

      <p className="text-center text-sm text-text-secondary">
        New to Toonflow?{' '}
        <Link
          href={redirect === '/' ? '/signup' : `/signup?redirect=${encodeURIComponent(redirect)}`}
          className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
