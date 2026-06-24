import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import Skeleton from '@/components/ui/Skeleton'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Toonflow Studio Paint',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-label="Loading sign-in form" />}>
      <LoginForm />
    </Suspense>
  )
}
