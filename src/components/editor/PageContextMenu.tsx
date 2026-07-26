'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Copy,
  ClipboardPaste,
  Files,
  Plus,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Pencil,
  Download,
  Maximize,
  Trash2,
} from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'
import { exportPagePng } from '@/lib/editor/exportProject'

const MENU_W = 220

interface Props {
  x: number
  y: number
  /** null = right-clicked empty canvas */
  pageId: string | null
  onClose: () => void
  onRename: (pageId: string) => void
}

interface Row {
  icon: typeof Copy
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean // draw a separator above this row
}

export function PageContextMenu({ x, y, pageId, onClose, onRename }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  const pages = useEditorStore((s) => s.pages)
  const order = useEditorStore((s) => s.timelineOrder)
  const clipboard = useEditorStore((s) => s.pageClipboard)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const removePage = useEditorStore((s) => s.removePage)
  const copyPage = useEditorStore((s) => s.copyPage)
  const pastePage = useEditorStore((s) => s.pastePage)
  const addPage = useEditorStore((s) => s.addPage)
  const addPageBelow = useEditorStore((s) => s.addPageBelow)
  const movePageOrder = useEditorStore((s) => s.movePageOrder)
  const updatePage = useEditorStore((s) => s.updatePage)
  const fitPage = useEditorStore((s) => s.fitPage)
  const fitAll = useEditorStore((s) => s.fitAll)

  const page = pageId ? pages.find((p) => p.id === pageId) ?? null : null
  const idx = pageId ? order.indexOf(pageId) : -1

  // Keep the menu on-screen.
  useEffect(() => {
    const h = ref.current?.offsetHeight ?? 320
    setPos({
      left: Math.min(x, window.innerWidth - MENU_W - 8),
      top: Math.min(y, window.innerHeight - h - 8),
    })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const rows: Row[] = page
    ? [
        { icon: Files, label: 'Duplicate', onClick: run(() => duplicatePage(page.id)) },
        { icon: Copy, label: 'Copy', onClick: run(() => copyPage(page.id)) },
        { icon: ClipboardPaste, label: 'Paste page', onClick: run(pastePage), disabled: !clipboard },
        { icon: Plus, label: 'Add page below', onClick: run(() => addPageBelow(page.id)), divider: true },
        { icon: ArrowUp, label: 'Move up', onClick: run(() => movePageOrder(page.id, 'up')), disabled: idx <= 0 },
        { icon: ArrowDown, label: 'Move down', onClick: run(() => movePageOrder(page.id, 'down')), disabled: idx < 0 || idx >= order.length - 1 },
        { icon: Pencil, label: 'Rename', onClick: run(() => onRename(page.id)), divider: true },
        {
          icon: page.isLocked ? Unlock : Lock,
          label: page.isLocked ? 'Unlock' : 'Lock',
          onClick: run(() => updatePage(page.id, { isLocked: !page.isLocked })),
        },
        {
          icon: page.isHidden ? Eye : EyeOff,
          label: page.isHidden ? 'Show' : 'Hide',
          onClick: run(() => updatePage(page.id, { isHidden: !page.isHidden })),
        },
        { icon: Maximize, label: 'Zoom to page', onClick: run(() => fitPage(page.id)) },
        { icon: Download, label: 'Export PNG', onClick: run(() => exportPagePng(page.id, page.name)) },
        { icon: Trash2, label: 'Delete page', onClick: run(() => removePage(page.id)), danger: true, divider: true },
      ]
    : [
        { icon: Plus, label: 'Add page', onClick: run(() => addPage()) },
        { icon: ClipboardPaste, label: 'Paste page', onClick: run(pastePage), disabled: !clipboard },
        { icon: Maximize, label: 'Fit all', onClick: run(() => fitAll()), divider: true },
      ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        role="menu"
        className="fixed z-50 py-1.5 rounded-xl bg-[#1E1E1E] border border-[#333] shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        style={{ left: pos.left, top: pos.top, width: MENU_W }}
      >
        {page && (
          <div className="px-3 pb-1.5 mb-1 border-b border-[#2A2A2A] text-[10px] font-semibold text-white/40 uppercase tracking-widest truncate">
            {page.name}
          </div>
        )}
        {rows.map((r, i) => (
          <React.Fragment key={r.label}>
            {r.divider && i > 0 && <div className="my-1 h-px bg-[#2A2A2A]" />}
            <button
              role="menuitem"
              onClick={r.onClick}
              disabled={r.disabled}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed ${
                r.danger ? 'text-danger hover:bg-danger/10' : 'text-white/80 hover:bg-white/5'
              }`}
            >
              <r.icon size={14} aria-hidden="true" />
              {r.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    </>
  )
}
