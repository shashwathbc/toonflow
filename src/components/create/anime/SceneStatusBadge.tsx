'use client'

import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { SceneStatus } from '@/types/anime'
import { cn } from '@/lib/utils/cn'

/**
 * Scene state at a glance.
 *
 * WCAG 1.4.1: status is never carried by colour alone — every state also has a
 * distinct icon AND a word, so it reads correctly in greyscale and to a screen
 * reader.
 */
const STATE = {
  idle: { label: 'Not generated', icon: Circle, tone: 'text-text-muted border-bg-border bg-bg-elevated' },
  queued: { label: 'Queued', icon: Loader2, tone: 'text-warning border-warning/25 bg-warning/10' },
  processing: { label: 'Generating', icon: Loader2, tone: 'text-studio-anime border-studio-anime/25 bg-studio-anime/10' },
  ready: { label: 'Ready', icon: CheckCircle2, tone: 'text-success border-success/25 bg-success/10' },
  failed: { label: 'Failed', icon: AlertTriangle, tone: 'text-danger border-danger/25 bg-danger/10' },
} as const satisfies Record<SceneStatus, { label: string; icon: typeof Circle; tone: string }>

export default function SceneStatusBadge({
  status,
  progress,
  className,
}: {
  status: SceneStatus
  progress?: number
  className?: string
}) {
  const { label, icon: Icon, tone } = STATE[status]
  const spinning = status === 'queued' || status === 'processing'
  const showProgress = status === 'processing' && typeof progress === 'number' && progress > 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        tone,
        className,
      )}
      // Progress updates are announced politely rather than interrupting.
      role="status"
      aria-live={spinning ? 'polite' : 'off'}
    >
      <Icon
        size={11}
        aria-hidden="true"
        className={cn(spinning && 'animate-spin motion-reduce:animate-none')}
      />
      {showProgress ? `${label} ${Math.round(progress)}%` : label}
    </span>
  )
}
