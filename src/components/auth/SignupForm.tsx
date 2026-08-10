'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'

export default function SignupForm() {
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? '/'
  // Prevent open redirect — only allow same-origin relative paths (mirrors LoginForm).
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'

  return (
    <div className="card p-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-text">Create account</h1>
        <p className="text-sm text-text-secondary">Join a growing community of creators and readers</p>
      </div>

      <GoogleAuthButton
        redirect={redirect}
        ariaLabel="Sign up with Google"
        successMessage="Welcome to Toonflow!"
        errorMessage="Google sign-up failed"
      />

      <p className="text-center text-xs text-text-muted">
        By continuing you agree to our{' '}
        <Link href="/terms" className="text-accent hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link
          href={redirect === '/' ? '/login' : `/login?redirect=${encodeURIComponent(redirect)}`}
          className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
