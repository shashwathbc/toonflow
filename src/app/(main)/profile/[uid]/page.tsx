import type { Metadata } from 'next'
import { ProfilePageClient } from './ProfilePageClient'

export const metadata: Metadata = {
  title: 'Profile',
}

interface ProfilePageProps {
  params: Promise<{ uid: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { uid } = await params
  return <ProfilePageClient uid={uid} />
}
