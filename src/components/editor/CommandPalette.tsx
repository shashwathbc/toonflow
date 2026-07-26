'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Search,
  FileStack,
  GitMerge,
  ImageDown,
  FileJson,
  Undo2,
  Redo2,
  MousePointer2,
  Type,
  Square,
  Circle,
  Hand,
  PanelLeft,
  PanelRight,
  PanelBottom,
  CopyPlus,
  Trash2,
  CornerDownLeft,
} from 'lucide-react'
import { useEditorStore, PAGE_PRESETS, type PageType } from '@/store/useEditorStore'
import { exportPagePng, exportProjectJson } from '@/lib/editor/exportProject'
import { cn } from '@/lib/utils/cn'

interface Cmd {
  id: string
  label: string
  hint?: string
  icon: typeof Search
  run: () => void
  keywords?: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      setQuery('')
      setActive(0)
    }
  }

  const onQueryChange = (v: string) => {
    setQuery(v)
    setActive(0)
  }

  // Store actions are stable, so this list never needs to be rebuilt; each run
  // reads fresh state via getState() to stay correct.
  const commands = useMemo<Cmd[]>(() => {
    const s = () => useEditorStore.getState()
    const pageCmds: Cmd[] = (Object.keys(PAGE_PRESETS) as PageType[]).map((t) => ({
      id: 'page-' + t,
      label: `New ${PAGE_PRESETS[t].label}`,
      hint: PAGE_PRESETS[t].hint,
      icon: FileStack,
      keywords: 'add create page ' + t,
      run: () => s().addPage({}, t),
    }))
    return [
      ...pageCmds,
      { id: 'merge', label: 'Merge Episode', hint: 'Stack pages vertically', icon: GitMerge, run: () => s().mergeEpisode() },
      { id: 'export-png', label: 'Export active page as PNG', icon: ImageDown, run: () => { const id = s().activePageId(); const p = s().pages.find((x) => x.id === id); if (p) exportPagePng(p.id, p.name) } },
      { id: 'export-json', label: 'Export project as JSON', icon: FileJson, run: () => exportProjectJson() },
      { id: 'undo', label: 'Undo', icon: Undo2, run: () => s().undo() },
      { id: 'redo', label: 'Redo', icon: Redo2, run: () => s().redo() },
      { id: 'dup', label: 'Duplicate selection', icon: CopyPlus, run: () => s().duplicateSelected() },
      { id: 'del', label: 'Delete selection', icon: Trash2, run: () => s().removeSelected() },
      { id: 't-select', label: 'Tool: Move', icon: MousePointer2, keywords: 'select v', run: () => s().setActiveTool('select') },
      { id: 't-hand', label: 'Tool: Hand', icon: Hand, keywords: 'pan h', run: () => s().setActiveTool('hand') },
      { id: 't-text', label: 'Tool: Text', icon: Type, keywords: 't', run: () => s().setActiveTool('text') },
      { id: 't-rect', label: 'Tool: Rectangle', icon: Square, keywords: 'r box', run: () => s().setActiveTool('rect') },
      { id: 't-ellipse', label: 'Tool: Ellipse', icon: Circle, keywords: 'o circle', run: () => s().setActiveTool('ellipse') },
      { id: 'p-left', label: 'Toggle left panel', icon: PanelLeft, run: () => s().toggleLeft() },
      { id: 'p-right', label: 'Toggle right panel', icon: PanelRight, run: () => s().toggleRight() },
      { id: 'p-bottom', label: 'Toggle timeline', icon: PanelBottom, run: () => s().toggleTimeline() },
    ]
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => (c.label + ' ' + (c.keywords ?? '')).toLowerCase().includes(q))
  }, [query, commands])

  const runAt = (i: number) => {
    const cmd = filtered[i]
    if (!cmd) return
    cmd.run()
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-[201] w-full max-w-xl -translate-x-1/2 rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A] shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            if (e.key === 'Enter') { e.preventDefault(); runAt(active) }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[#2A2A2A]">
            <Search size={16} className="text-white/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search actions, add pages, switch tools…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
            />
            <kbd className="text-[10px] text-white/30 border border-[#333] rounded px-1.5 py-0.5">ESC</kbd>
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-[#333]">
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-xs text-white/40">No matching commands</div>}
            {filtered.map((c, i) => (
              <button
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  i === active ? 'bg-[#4C9AFF]/15' : 'hover:bg-white/5',
                )}
              >
                <c.icon size={16} className={cn(i === active ? 'text-[#4C9AFF]' : 'text-white/50')} />
                <span className="flex-1 text-xs text-white">{c.label}</span>
                {c.hint && <span className="text-[10px] text-white/35 font-mono">{c.hint}</span>}
                {i === active && <CornerDownLeft size={13} className="text-white/40" />}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
