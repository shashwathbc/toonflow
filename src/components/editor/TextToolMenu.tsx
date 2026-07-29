'use client'

import { Type, MessageSquare, Cloud, Zap, AlertTriangle, MessageCircle, Captions, Cpu } from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'
import { BUBBLE_DEFS, type BubbleKind } from '@/lib/editor/bubbles'
import { cn } from '@/lib/utils/cn'

// Icons for the emotion bubble picker. `bubbles.ts` defines ~30 BubbleKinds;
// the ones without a bespoke icon fall back to a generic speech icon at the
// call site (see `ICONS[d.kind] ?? MessageSquare` below), so this map can stay
// Partial and grow as designers assign per-emotion icons without breaking the
// exhaustive-type contract.
const ICONS: Partial<Record<BubbleKind, typeof Type>> = {
  speech: MessageSquare,
  thought: Cloud,
  shout: Zap,
  scream: AlertTriangle,
  whisper: MessageCircle,
  narration: Captions,
  electronic: Cpu,
}

/**
 * Dropdown shown while the Text tool is active: pick plain text or one of the
 * emotion speech bubbles, then click a page to place it. The choice is stored in
 * `pendingBubbleKind`, which the Workspace consumes on the next page click.
 */
export function TextToolMenu({ onPick }: { onPick: () => void }) {
  const activeTool = useEditorStore((s) => s.activeTool)
  const pending = useEditorStore((s) => s.pendingBubbleKind)
  const setPending = useEditorStore((s) => s.setPendingBubbleKind)

  if (activeTool !== 'text') return null

  const pick = (kind: BubbleKind | null) => {
    setPending(kind)
    onPick()
  }

  return (
    <div className="absolute top-[4.75rem] left-1/2 -translate-x-1/2 z-30 w-[320px] bg-[#1B1B1B]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-[#2E2E2E] p-3 space-y-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Text &amp; Speech</span>

      <button
        type="button"
        onClick={() => pick(null)}
        aria-pressed={pending === null}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]',
          pending === null
            ? 'bg-[#4C9AFF] border-[#4C9AFF] text-white'
            : 'border-[#2E2E2E] text-white/70 hover:text-white hover:border-white/30',
        )}
      >
        <Type size={15} className="shrink-0" />
        <span className="text-xs font-medium">Plain Text</span>
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        {BUBBLE_DEFS.map((d) => {
          const Icon = ICONS[d.kind] ?? MessageSquare
          const sel = pending === d.kind
          return (
            <button
              key={d.kind}
              type="button"
              onClick={() => pick(d.kind)}
              aria-pressed={sel}
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]',
                sel
                  ? 'bg-[#4C9AFF] border-[#4C9AFF] text-white'
                  : 'border-[#2E2E2E] text-white/70 hover:text-white hover:border-white/30',
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-medium leading-tight truncate">{d.label}</span>
                <span className={cn('block text-[10px] leading-tight truncate', sel ? 'text-white/70' : 'text-white/40')}>{d.emotion}</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[10px] text-white/40 leading-relaxed">
        Pick one, then click a page to place it. Double-click to edit the text; drag the corners to resize.
      </p>
    </div>
  )
}
