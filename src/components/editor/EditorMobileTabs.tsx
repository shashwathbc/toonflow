'use client'

import { FileText, PenLine, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type EditorPanel = 'chapters' | 'editor' | 'ai'

interface EditorMobileTabsProps {
  active: EditorPanel
  onChange: (panel: EditorPanel) => void
  chapterCount: number
}

const TABS: { id: EditorPanel; label: string; Icon: typeof FileText }[] = [
  { id: 'chapters', label: 'Chapters', Icon: FileText },
  { id: 'editor', label: 'Write', Icon: PenLine },
  { id: 'ai', label: 'Assistant', Icon: Sparkles },
]

/**
 * Mobile-only bottom navigation that switches the editor between its three
 * panels. On lg+ all three panels render side by side, so this is hidden and
 * the switcher state is ignored.
 */
export function EditorMobileTabs({ active, onChange, chapterCount }: EditorMobileTabsProps) {
  return (
    <nav
      className="lg:hidden flex items-stretch border-t border-bg-border bg-bg flex-shrink-0 pb-[env(safe-area-inset-bottom)]"
      aria-label="Editor panels"
      role="navigation"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none',
              isActive ? 'text-accent' : 'text-white/45 hover:text-white/70'
            )}
            aria-current={isActive ? 'page' : undefined}
            aria-label={id === 'chapters' ? `Chapters, ${chapterCount} total` : label}
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
            <span className="relative">
              <Icon size={18} aria-hidden="true" />
              {id === 'chapters' && chapterCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
                  {chapterCount}
                </span>
              )}
            </span>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
