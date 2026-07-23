'use client'

import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'

// A small curated set — enough for quick reactions without pulling in a whole
// emoji library. Insertion happens at the caret in the composer.
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
  '🤩', '🥳', '😅', '😉', '🙂', '🙃', '😌', '😴',
  '😇', '🤔', '🤨', '😐', '😏', '😢', '😭', '😤',
  '😠', '😡', '🥺', '😳', '😱', '🤯', '😬', '🙄',
  '😈', '👻', '💀', '🤡', '👍', '👎', '👏', '🙌',
  '🙏', '💪', '👀', '🔥', '✨', '⭐', '🎉', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🖤', '💯', '🎨',
]

export default function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Insert emoji"
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn-ghost rounded-lg p-2 text-text-muted hover:text-text"
      >
        <Smile size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Emoji"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-bg-border bg-bg-card p-2 shadow-xl"
        >
          <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-border">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onSelect(e); setOpen(false) }}
                className="rounded-md p-1 text-lg hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Emoji ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
