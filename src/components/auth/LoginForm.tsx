'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { signInWithEmail, signInWithGoogle } from '@/lib/firebase/auth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? '/'
  // Prevent open redirect — only allow same-origin relative paths
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await signInWithEmail(data.email, data.password)
      toast.success('Welcome back!')
      router.push(redirect)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      toast.error(message.includes('wrong-password') || message.includes('user-not-found')
        ? 'Invalid email or password'
        : 'Login failed. Please try again.')
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      toast.success('Welcome!')
      router.push(redirect)
    } catch {
      toast.error('Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-text">Sign in</h1>
        <p className="text-sm text-text-secondary">Welcome back to Toonflow</p>
      </div>

      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        isLoading={googleLoading}
        aria-label="Sign in with Google"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <hr className="flex-1 border-bg-border" />
        <span className="text-xs text-text-muted select-none">or</span>
        <hr className="flex-1 border-bg-border" />
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          required
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          required
          {...register('password')}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
          Sign up
        </Link>
      </p>
    </div>
  )
}
