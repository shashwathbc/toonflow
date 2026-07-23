import type { Metadata } from 'next'
import ThreadClient from './ThreadClient'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Your conversation on Toonflow Studio Paint.',
  robots: { index: false, follow: false },
}

interface MessagePageProps {
  params: Promise<{ conversationId: string }>
}

export default async function MessagePage({ params }: MessagePageProps) {
  const { conversationId } = await params
  return <ThreadClient conversationId={conversationId} />
}
