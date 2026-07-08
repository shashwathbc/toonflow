'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils/cn'

/**
 * TooltipProvider — mount once near the app root. Controls the global open
 * delay (`delayDuration`) and the grace window (`skipDelayDuration`) during
 * which moving between adjacent tooltips (e.g. a toolbar row) opens instantly
 * instead of re-waiting the delay.
 */
export const TooltipProvider = TooltipPrimitive.Provider

export interface TooltipProps {
  /** Human-readable text shown on hover/focus. Also the accessible description. */
  label: React.ReactNode
  /** The trigger. Must be a single element that forwards ref/props (button, a, Radix Trigger…). */
  children: React.ReactNode
  /** Preferred side. Radix auto-flips to avoid clipping the viewport. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Render children untouched (no tooltip) — handy when the label is conditional/empty. */
  disabled?: boolean
  className?: string
}

/**
 * Shared tooltip for the whole app. Wrap any interactive icon/trigger:
 *
 *   <Tooltip label="Save changes">
 *     <button aria-label="Save changes"><Save /></button>
 *   </Tooltip>
 *
 * Behaviour: opens after the provider's delay (~200ms) on hover, instantly on
 * keyboard focus; closes on blur/leave/escape. Collision-aware positioning keeps
 * it inside the viewport, with a subtle 150ms fade+scale on open. The tooltip is
 * supplementary — always keep a matching `aria-label` on the trigger so screen
 * readers announce the control even though tooltips aren't read reliably.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  disabled = false,
  className,
}: TooltipProps) {
  if (disabled || label === null || label === undefined || label === '') {
    return <>{children}</>
  }

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          role="tooltip"
          className={cn(
            // container — dark theme, rounded, soft shadow, high-contrast text
            'z-[70] max-w-[16rem] select-none rounded-lg border border-bg-border bg-bg-elevated',
            'px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-xl',
            // scale from the edge nearest the trigger, subtle 150ms fade+scale in
            'origin-[var(--radix-tooltip-content-transform-origin)]',
            'data-[state=delayed-open]:animate-scale-in data-[state=instant-open]:animate-scale-in',
            className
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-bg-elevated" width={11} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
