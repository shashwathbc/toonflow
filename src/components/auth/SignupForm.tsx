'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function SignupForm() {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await signUpWithEmail(data.email, data.password, data.displayName)
      toast.success('Account created! Welcome to Toonflow!')
      router.push('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      toast.error(message.includes('email-already-in-use')
        ? 'An account with this email already exists'
        : 'Signup failed. Please try again.')
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      toast.success('Welcome to Toonflow!')
      router.push('/')
    } catch {
      toast.error('Google sign-up failed')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-text">Create account</h1>
        <p className="text-sm text-text-secondary">Join thousands of creators and readers</p>
      </div>

      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        isLoading={googleLoading}
        aria-label="Sign up with Google"
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Display name"
          type="text"
          autoComplete="name"
          placeholder="Your creator name"
          error={errors.displayName?.message}
          required
          {...register('displayName')}
        />
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
          autoComplete="new-password"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          error={errors.password?.message}
          required
          {...register('password')}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          required
          {...register('confirmPassword')}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="text-center text-xs text-text-muted">
        By signing up you agree to our{' '}
        <Link href="/terms" className="text-accent hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
