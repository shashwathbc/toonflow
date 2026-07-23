'use client'

import { usePathname } from 'next/navigation'
import ConversationSidebar from '@/components/messages/ConversationSidebar'
import { cn } from '@/lib/utils/cn'

/**
 * Two-pane messages shell. The conversation sidebar stays mounted across thread
 * navigation (its real-time listener persists). Responsive: on mobile only one
 * pane shows at a time — the list on `/messages`, the thread on
 * `/messages/[id]` (with an in-thread back button). On desktop both show.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const onThread = pathname !== '/messages'

  return (
    <div className="mx-auto w-full max-w-screen-xl md:px-4 md:py-4">
      <div className="flex h-[calc(100dvh-7rem)] overflow-hidden bg-bg-card md:h-[calc(100dvh-5.5rem)] md:rounded-2xl md:border md:border-bg-border">
        <ConversationSidebar
          className={cn(
            'w-full md:w-80 lg:w-96 md:border-r md:border-bg-border',
            onThread ? 'hidden md:flex' : 'flex'
          )}
        />
        <div className={cn('min-w-0 flex-1', onThread ? 'flex' : 'hidden md:flex')}>
          {children}
        </div>
      </div>
    </div>
  )
}
