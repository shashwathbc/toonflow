'use client'

import React, { useEffect, useRef, useState } from 'react'
import { GripVertical, PanelLeft, PanelRight, PanelBottom, RotateCcw, ChevronsUpDown } from 'lucide-react'
import { useEditorStore, type DockSlot, type DockPanelId } from '@/store/useEditorStore'
import { cn } from '@/lib/utils/cn'

/** Human-facing name for each dockable panel. */
export const DOCK_META: Record<DockPanelId, { title: string }> = {
  navigator: { title: 'Pages & Assets' },
  inspector: { title: 'Properties' },
  timeline: { title: 'Story Timeline' },
}

const SLOT_META: Record<DockSlot, { label: string; icon: typeof PanelLeft }> = {
  left: { label: 'Dock left', icon: PanelLeft },
  right: { label: 'Dock right', icon: PanelRight },
  bottom: { label: 'Dock bottom', icon: PanelBottom },
}
const SLOTS: DockSlot[] = ['left', 'right', 'bottom']

/** Which slot-visibility toggle backs each physical slot. */
function useToggleForSlot(slot: DockSlot) {
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const toggleRight = useEditorStore((s) => s.toggleRight)
  const toggleTimeline = useEditorStore((s) => s.toggleTimeline)
  return slot === 'left' ? toggleLeft : slot === 'right' ? toggleRight : toggleTimeline
}

/**
 * Slim grab bar shown at the top of every docked panel. Drag it to move the whole
 * panel to another slot; the ⌄ menu (click/keyboard) does the same without a drag,
 * and the collapse button hides the slot.
 */
export function DockBar({ panel, slot }: { panel: DockPanelId; slot: DockSlot }) {
  const setDockDrag = useEditorStore((s) => s.setDockDrag)
  const movePanelToSlot = useEditorStore((s) => s.movePanelToSlot)
  const resetDockLayout = useEditorStore((s) => s.resetDockLayout)
  const dragging = useEditorStore((s) => s.dockDrag === panel)
  const collapse = useToggleForSlot(slot)
  const [menuOpen, setMenuOpen] = useState(false)
  const startedAt = useRef<{ x: number; y: number } | null>(null)

  // Start a drag only after the pointer actually moves a few px, so a plain click
  // on the grip opens the menu instead of beginning a (zero-distance) drag.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    startedAt.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = startedAt.current
    if (!s || dragging) return
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) setDockDrag(panel)
  }
  const onPointerUp = () => {
    startedAt.current = null
  }

  return (
    <div
      className={cn(
        'group/dock relative flex h-6 shrink-0 items-center gap-1.5 border-b border-[#222] bg-[#141414] pl-1.5 pr-1 select-none',
        dragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label={`Move ${DOCK_META[panel].title} panel — drag to another edge, or use the menu`}
        title="Drag to move this panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex flex-1 items-center gap-1 cursor-grab active:cursor-grabbing text-white/35 hover:text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF] rounded"
      >
        <GripVertical size={12} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{DOCK_META[panel].title}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label="Move panel to a different edge"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]"
        >
          <ChevronsUpDown size={12} aria-hidden="true" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              className="absolute right-0 top-6 z-50 w-40 rounded-lg border border-[#2A2A2A] bg-[#1B1B1B] p-1 shadow-xl"
            >
              {SLOTS.map((s) => {
                const Icon = SLOT_META[s].icon
                const current = s === slot
                return (
                  <button
                    key={s}
                    role="menuitem"
                    disabled={current}
                    onClick={() => {
                      movePanelToSlot(panel, s)
                      setMenuOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      current ? 'text-white/30 cursor-default' : 'text-white/80 hover:bg-white/5',
                    )}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {SLOT_META[s].label}
                    {current && <span className="ml-auto text-[9px] uppercase text-white/25">here</span>}
                  </button>
                )
              })}
              <div className="my-1 h-px bg-[#2A2A2A]" />
              <button
                role="menuitem"
                onClick={() => {
                  resetDockLayout()
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/70 hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={13} aria-hidden="true" /> Reset layout
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label={`Collapse ${DOCK_META[panel].title} panel`}
        title="Collapse"
        onClick={collapse}
        className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4C9AFF]"
      >
        <PanelBottom size={12} aria-hidden="true" className={slot === 'bottom' ? '' : 'rotate-90'} />
      </button>
    </div>
  )
}

/**
 * Full-body overlay shown ONLY while a panel is being dragged. Renders the three
 * drop targets (left / right / bottom) that highlight under the cursor and commit
 * the move on release, plus a small label chasing the cursor. Mount once inside
 * the (relative) editor body.
 */
export function DockOverlay() {
  const dragging = useEditorStore((s) => s.dockDrag)
  const overSlot = useEditorStore((s) => s.dockOverSlot)
  const setDockOverSlot = useEditorStore((s) => s.setDockOverSlot)
  const setDockDrag = useEditorStore((s) => s.setDockDrag)
  const movePanelToSlot = useEditorStore((s) => s.movePanelToSlot)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Commit on pointer-up anywhere; track the cursor for the floating label. These
  // are window-level so the drag survives the pointer leaving the drop zones.
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    const onUp = () => {
      const { dockDrag, dockOverSlot } = useEditorStore.getState()
      if (dockDrag && dockOverSlot) movePanelToSlot(dockDrag, dockOverSlot)
      else {
        setDockDrag(null)
        setDockOverSlot(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, movePanelToSlot, setDockDrag, setDockOverSlot])

  if (!dragging) return null

  const zone = (slot: DockSlot, className: string) => (
    <div
      onPointerEnter={() => setDockOverSlot(slot)}
      onPointerLeave={() => {
        if (useEditorStore.getState().dockOverSlot === slot) setDockOverSlot(null)
      }}
      className={cn(
        'pointer-events-auto absolute rounded-xl border-2 border-dashed transition-colors',
        overSlot === slot
          ? 'border-[#4C9AFF] bg-[#4C9AFF]/15'
          : 'border-white/15 bg-white/[0.03] hover:border-white/30',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-widest text-white/60">
        {SLOT_META[slot].label.replace('Dock ', '')}
      </span>
    </div>
  )

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Left / right strips stop short of the bottom strip so corners don't overlap. */}
      {zone('left', 'left-2 top-2 bottom-[34%] w-[26%]')}
      {zone('right', 'right-2 top-2 bottom-[34%] w-[26%]')}
      {zone('bottom', 'left-2 right-2 bottom-2 h-[30%]')}
      <div
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#4C9AFF] px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
        style={{ left: pos.x, top: pos.y - 22 }}
      >
        {dragging ? DOCK_META[dragging].title : ''}
      </div>
    </div>
  )
}
