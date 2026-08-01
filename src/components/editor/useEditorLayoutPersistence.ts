'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore, type DockPanelId, type DockSlot, type LeftTab, type RightTab } from '@/store/useEditorStore'

/**
 * Persists the editor's LAYOUT preferences (which panel is docked where, panel
 * sizes, collapsed state, active tabs) to localStorage so the workspace comes
 * back exactly as the user left it. The editor store itself is intentionally NOT
 * wrapped in zustand's persist middleware — that would also persist the whole
 * canvas/undo state — so this hook syncs just the layout slice.
 */

const KEY = 'toonflow.editor.layout.v1'
const PANELS: DockPanelId[] = ['navigator', 'inspector', 'timeline']
const SLOTS: DockSlot[] = ['left', 'right', 'bottom']
const LEFT_TABS: LeftTab[] = ['pages', 'layers', 'assets', 'characters', 'ai']
const RIGHT_TABS: RightTab[] = ['properties', 'assistant', 'export']

interface SavedLayout {
  panelSlots: Record<DockPanelId, DockSlot>
  leftWidth: number
  rightWidth: number
  timelineHeight: number
  leftOpen: boolean
  rightOpen: boolean
  timelineOpen: boolean
  leftTab: LeftTab
  rightTab: RightTab
}

function snapshot(): SavedLayout {
  const s = useEditorStore.getState()
  return {
    panelSlots: s.panelSlots,
    leftWidth: s.leftWidth,
    rightWidth: s.rightWidth,
    timelineHeight: s.timelineHeight,
    leftOpen: s.leftOpen,
    rightOpen: s.rightOpen,
    timelineOpen: s.timelineOpen,
    leftTab: s.leftTab,
    rightTab: s.rightTab,
  }
}

/** A stored panelSlots is only usable if it's still a valid 3-panel bijection. */
function validSlots(v: unknown): v is Record<DockPanelId, DockSlot> {
  if (!v || typeof v !== 'object') return false
  const rec = v as Record<string, unknown>
  const assigned = PANELS.map((p) => rec[p])
  return (
    PANELS.every((p) => typeof rec[p] === 'string' && SLOTS.includes(rec[p] as DockSlot)) &&
    new Set(assigned).size === PANELS.length
  )
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function useEditorLayoutPersistence() {
  const applied = useRef(false)
  const lastWritten = useRef('')

  // Apply the saved layout once on mount.
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedLayout>
        const patch: Partial<SavedLayout> = {}
        if (validSlots(saved.panelSlots)) patch.panelSlots = saved.panelSlots
        patch.leftWidth = num(saved.leftWidth, useEditorStore.getState().leftWidth)
        patch.rightWidth = num(saved.rightWidth, useEditorStore.getState().rightWidth)
        patch.timelineHeight = num(saved.timelineHeight, useEditorStore.getState().timelineHeight)
        if (typeof saved.leftOpen === 'boolean') patch.leftOpen = saved.leftOpen
        if (typeof saved.rightOpen === 'boolean') patch.rightOpen = saved.rightOpen
        if (typeof saved.timelineOpen === 'boolean') patch.timelineOpen = saved.timelineOpen
        if (typeof saved.leftTab === 'string' && LEFT_TABS.includes(saved.leftTab)) patch.leftTab = saved.leftTab
        if (typeof saved.rightTab === 'string' && RIGHT_TABS.includes(saved.rightTab)) patch.rightTab = saved.rightTab
        useEditorStore.setState(patch)
      }
    } catch {
      /* ignore malformed/blocked storage */
    }
    lastWritten.current = JSON.stringify(snapshot())
  }, [])

  // Persist on change — the listener runs on every store update, but it only
  // touches localStorage when the layout slice actually changed (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useEditorStore.subscribe(() => {
      const snap = JSON.stringify(snapshot())
      if (snap === lastWritten.current) return
      lastWritten.current = snap
      clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, snap)
        } catch {
          /* storage full / blocked — non-fatal */
        }
      }, 300)
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [])
}
