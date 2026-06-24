import type { Metadata } from 'next'
import SignupForm from '@/components/auth/SignupForm'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Join Toonflow Studio Paint and start reading or creating today.',
}

export default function SignupPage() {
  return <SignupForm />
}
