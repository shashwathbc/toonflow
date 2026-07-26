'use client'

import React, { useRef } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Thin draggable divider. Reports the pointer delta since drag start on each
 * move so parents can grow/shrink a panel. `dir` picks the axis + which sign
 * grows the panel (a left-edge handle grows when dragged left).
 */
export function ResizeHandle({
  orientation,
  onDelta,
  invert = false,
}: {
  orientation: 'vertical' | 'horizontal'
  onDelta: (delta: number) => void
  invert?: boolean
}) {
  const last = useRef(0)

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    last.current = orientation === 'vertical' ? e.clientX : e.clientY
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return
    const pos = orientation === 'vertical' ? e.clientX : e.clientY
    const delta = (pos - last.current) * (invert ? -1 : 1)
    last.current = pos
    if (delta) onDelta(delta)
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        'group relative z-20 shrink-0',
        orientation === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
      )}
    >
      <div
        className={cn(
          'absolute bg-transparent group-hover:bg-[#4C9AFF] group-active:bg-[#4C9AFF] transition-colors',
          orientation === 'vertical' ? 'inset-y-0 left-0 w-0.5' : 'inset-x-0 top-0 h-0.5',
        )}
      />
    </div>
  )
}
