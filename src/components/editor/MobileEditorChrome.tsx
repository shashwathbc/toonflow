'use client'

import React, { useState } from 'react'
import { FileStack, Layers, FolderOpen, Sparkles, SlidersHorizontal, Film } from 'lucide-react'
import { useEditorStore, type LeftTab } from '@/store/useEditorStore'
import { SidebarLeft } from '@/components/editor/SidebarLeft'
import { SidebarRight } from '@/components/editor/SidebarRight'
import { TimelineBottom } from '@/components/editor/TimelineBottom'
import { cn } from '@/lib/utils/cn'

type Drawer = 'left' | 'right' | 'timeline' | null

/**
 * Phone / portrait-tablet editor chrome. The three desktop panels don't fit
 * side-by-side on a narrow screen, so here they become one-at-a-time slide-in
 * drawers driven by a bottom tab bar, leaving the canvas full-bleed. Only
 * mounted while `useIsMobile()` is true (parent-gated), so the heavy sidebars
 * never double-mount alongside their desktop instances.
 */
export function MobileEditorChrome() {
  const [drawer, setDrawer] = useState<Drawer>(null)
  const leftTab = useEditorStore((s) => s.leftTab)
  const setLeftTab = useEditorStore((s) => s.setLeftTab)
  const setRightTab = useEditorStore((s) => s.setRightTab)

  const openLeft = (tab: LeftTab) => {
    setLeftTab(tab)
    setDrawer('left')
  }

  const items: {
    key: string
    label: string
    Icon: typeof FileStack
    active: boolean
    onOpen: () => void
  }[] = [
    { key: 'pages', label: 'Pages', Icon: FileStack, active: drawer === 'left' && leftTab === 'pages', onOpen: () => openLeft('pages') },
    { key: 'layers', label: 'Layers', Icon: Layers, active: drawer === 'left' && leftTab === 'layers', onOpen: () => openLeft('layers') },
    { key: 'assets', label: 'Assets', Icon: FolderOpen, active: drawer === 'left' && leftTab === 'assets', onOpen: () => openLeft('assets') },
    { key: 'ai', label: 'AI', Icon: Sparkles, active: drawer === 'left' && leftTab === 'ai', onOpen: () => openLeft('ai') },
    { key: 'edit', label: 'Edit', Icon: SlidersHorizontal, active: drawer === 'right', onOpen: () => { setRightTab('properties'); setDrawer('right') } },
    { key: 'timeline', label: 'Scenes', Icon: Film, active: drawer === 'timeline', onOpen: () => setDrawer('timeline') },
  ]

  return (
    <>
      {/* Overlay lives between the header (h-12) and the bottom bar (h-14). */}
      {drawer && (
        <div className="fixed inset-x-0 top-12 bottom-14 z-40" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setDrawer(null)}
          />
          <div
            className={cn(
              'absolute bg-[#161616] shadow-2xl overflow-hidden animate-in duration-200',
              drawer === 'timeline'
                ? 'left-0 right-0 bottom-0 rounded-t-2xl slide-in-from-bottom'
                : drawer === 'right'
                  ? 'top-0 right-0 bottom-0 w-[86vw] max-w-[360px] slide-in-from-right'
                  : 'top-0 left-0 bottom-0 w-[86vw] max-w-[360px] slide-in-from-left',
            )}
          >
            {drawer === 'left' && <SidebarLeft />}
            {drawer === 'right' && <SidebarRight />}
            {drawer === 'timeline' && <TimelineBottom />}
          </div>
        </div>
      )}

      {/* Bottom tab bar — z-50 so it stays above the drawer and always tappable. */}
      <nav
        className="relative z-50 h-14 shrink-0 flex items-stretch bg-[#141414] border-t border-[#262626] pb-[env(safe-area-inset-bottom)]"
        aria-label="Editor panels"
      >
        {items.map(({ key, label, Icon, active, onOpen }) => (
          <button
            key={key}
            type="button"
            onClick={() => (active ? setDrawer(null) : onOpen())}
            aria-pressed={active}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[9.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4C9AFF]',
              active ? 'text-[#4C9AFF]' : 'text-white/50 active:text-white/80',
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}
