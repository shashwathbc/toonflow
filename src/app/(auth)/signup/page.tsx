import type { Metadata } from 'next'
import { Suspense } from 'react'
import SignupForm from '@/components/auth/SignupForm'
import Skeleton from '@/components/ui/Skeleton'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Join Toonflow Studio Paint and start reading or creating today.',
}

export default function SignupPage() {
  // SignupForm reads `redirect` from the query string, so it needs a boundary
  // to prerender behind — same shape as the sign-in page.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" aria-label="Loading sign-up form" />}>
      <SignupForm />
    </Suspense>
  )
}
