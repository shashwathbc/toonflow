import type { Metadata } from 'next'
import { MessagesSquare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Your conversations on Toonflow Studio Paint.',
  robots: { index: false, follow: false },
}

/**
 * Inbox index. On mobile the parent layout hides this pane and shows the
 * conversation list instead; on desktop it's the right-pane placeholder shown
 * until a conversation is selected.
 */
export default function MessagesIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <MessagesSquare size={48} className="mb-4 text-text-muted/50" aria-hidden="true" />
      <h1 className="text-lg font-bold text-text">Your messages</h1>
      <p className="mt-1 max-w-xs text-sm text-text-secondary">
        Select a conversation, or start a new one with a mutual follower.
      </p>
    </div>
  )
}
