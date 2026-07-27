'use client'

import { useEffect } from 'react'
import { useEditorStore, type ToolId } from '@/store/useEditorStore'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  h: 'hand',
  f: 'frame',
  b: 'brush',
  e: 'eraser',
  t: 'text',
  r: 'rect',
  o: 'ellipse',
}

function isTyping(t: EventTarget | null) {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  )
}

/** Global editor keyboard map. Mounted once from the editor page. */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const s = useEditorStore.getState()
      const mod = e.ctrlKey || e.metaKey

      // undo / redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      // duplicate
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.duplicateSelected()
        return
      }
      // select all in page
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.selectAllInPage()
        return
      }
      if (mod) return // leave other Ctrl combos (K handled elsewhere, browser shortcuts)

      // delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedElementIds.length) {
          e.preventDefault()
          s.removeSelected()
        }
        return
      }
      // deselect
      if (e.key === 'Escape') {
        s.clearSelection()
        return
      }
      // nudge
      if (e.key.startsWith('Arrow') && s.selectedElementIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowUp') s.nudgeSelected(0, -step)
        if (e.key === 'ArrowDown') s.nudgeSelected(0, step)
        if (e.key === 'ArrowLeft') s.nudgeSelected(-step, 0)
        if (e.key === 'ArrowRight') s.nudgeSelected(step, 0)
        return
      }
      // tools
      const tool = TOOL_KEYS[e.key.toLowerCase()]
      if (tool) {
        s.setActiveTool(tool)
        // Selecting a paint tool via keyboard also reopens its settings panel.
        if (tool === 'brush' || tool === 'eraser') s.setBrushPanelOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
