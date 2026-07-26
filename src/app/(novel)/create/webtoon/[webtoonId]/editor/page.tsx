'use client'

import React, { use, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ChevronLeft,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Play,
  Save,
  Globe,
  ChevronUp,
  Command,
} from 'lucide-react'
import { SidebarLeft } from '@/components/editor/SidebarLeft'
import { SidebarRight } from '@/components/editor/SidebarRight'
import { TimelineBottom } from '@/components/editor/TimelineBottom'
import { SmartDropzone } from '@/components/editor/SmartDropzone'
import { TopToolbar } from '@/components/editor/TopToolbar'
import { CommandPalette } from '@/components/editor/CommandPalette'
import { ResizeHandle } from '@/components/editor/ResizeHandle'
import { useEditorShortcuts } from '@/components/editor/useEditorShortcuts'
import { useEditorStore } from '@/store/useEditorStore'
import { cn } from '@/lib/utils/cn'

// Konva must be client-only and code-split so it never evaluates during SSR.
const WorkspaceDynamic = dynamic(
  () => import('@/components/editor/Workspace').then((m) => m.Workspace),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-[#0C0C0C] flex items-center justify-center text-white/30 text-sm">Loading canvas…</div>,
  },
)

export default function WebtoonEditorPage({ params }: { params: Promise<{ webtoonId: string }> }) {
  const { webtoonId } = use(params)

  const addPage = useEditorStore((s) => s.addPage)
  const selectPage = useEditorStore((s) => s.selectPage)
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const rightOpen = useEditorStore((s) => s.rightOpen)
  const timelineOpen = useEditorStore((s) => s.timelineOpen)
  const leftWidth = useEditorStore((s) => s.leftWidth)
  const rightWidth = useEditorStore((s) => s.rightWidth)
  const setLeftWidth = useEditorStore((s) => s.setLeftWidth)
  const setRightWidth = useEditorStore((s) => s.setRightWidth)
  const setTimelineHeight = useEditorStore((s) => s.setTimelineHeight)
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const toggleRight = useEditorStore((s) => s.toggleRight)
  const toggleTimeline = useEditorStore((s) => s.toggleTimeline)

  useEditorShortcuts()

  // First-run seed: a cover + an opening scene.
  useEffect(() => {
    if (useEditorStore.getState().pages.length === 0) {
      const coverId = addPage({ name: 'Cover' }, 'cover')
      addPage({ name: 'Scene 1' }, 'webtoon')
      selectPage(coverId)
    }
  }, [addPage, selectPage])

  const toggleBtn = 'w-8 h-8 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]'

  return (
    <SmartDropzone>
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-black text-white select-none">
        {/* Top bar */}
        <header className="h-12 bg-[#141414] border-b border-[#262626] flex items-center px-3 justify-between shrink-0 z-30">
          <div className="flex items-center gap-2">
            <Link href={`/create/webtoon/${webtoonId}`} aria-label="Back to webtoon" className={cn(toggleBtn, 'text-white/60 hover:text-white hover:bg-white/10')}>
              <ChevronLeft size={18} />
            </Link>
            <div className="h-4 w-px bg-[#2E2E2E]" />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-white">Toonflow Studio</span>
              <span className="text-[10px] text-white/35">Infinite canvas · autosaved</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={toggleLeft} aria-label="Toggle left panel" aria-pressed={leftOpen} className={cn(toggleBtn, leftOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelLeft size={16} />
            </button>
            <button onClick={toggleTimeline} aria-label="Toggle timeline" aria-pressed={timelineOpen} className={cn(toggleBtn, timelineOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelBottom size={16} />
            </button>
            <button onClick={toggleRight} aria-label="Toggle right panel" aria-pressed={rightOpen} className={cn(toggleBtn, rightOpen ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5')}>
              <PanelRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/35 border border-[#2A2A2A] rounded-md px-1.5 py-1">
              <Command size={11} /> K
            </span>
            <button className="h-8 px-2.5 flex items-center gap-1.5 text-xs text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <Save size={14} /> Save
            </button>
            <button className="h-8 px-2.5 flex items-center gap-1.5 text-xs text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <Play size={14} /> Preview
            </button>
            <button className="h-8 px-3 flex items-center gap-1.5 text-xs font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors">
              <Globe size={14} /> Publish
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {leftOpen && (
            <>
              <div style={{ width: leftWidth }} className="h-full shrink-0">
                <SidebarLeft />
              </div>
              <ResizeHandle orientation="vertical" onDelta={(d) => setLeftWidth(leftWidth + d)} />
            </>
          )}

          <div className="relative flex-1 flex flex-col overflow-hidden">
            <TopToolbar />
            <WorkspaceDynamic />
          </div>

          {rightOpen && (
            <>
              <ResizeHandle orientation="vertical" invert onDelta={(d) => setRightWidth(rightWidth - d)} />
              <div style={{ width: rightWidth }} className="h-full shrink-0">
                <SidebarRight />
              </div>
            </>
          )}
        </div>

        {/* Timeline */}
        {timelineOpen ? (
          <>
            <ResizeHandle orientation="horizontal" invert onDelta={(d) => setTimelineHeight(useEditorStore.getState().timelineHeight + d)} />
            <TimelineBottom />
          </>
        ) : (
          <button
            onClick={toggleTimeline}
            className="h-7 bg-[#141414] border-t border-[#262626] flex items-center gap-2 px-3 text-white/45 hover:text-white transition-colors shrink-0"
          >
            <ChevronUp size={13} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Story Timeline</span>
          </button>
        )}

        <CommandPalette />
      </div>
    </SmartDropzone>
  )
}
