'use client'

import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GitMerge, ZoomIn, ZoomOut, Maximize, ChevronDown } from 'lucide-react'
import { useEditorStore, type Page } from '@/store/useEditorStore'
import { cn } from '@/lib/utils/cn'

// -- lightweight live preview of a page (no Konva) --------------------------
function PagePreview({ page }: { page: Page }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: page.backgroundColor }}>
      {page.elements.filter((e) => !e.isHidden).map((el) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${(el.x / page.width) * 100}%`,
          top: `${(el.y / page.height) * 100}%`,
          width: `${(el.width / page.width) * 100}%`,
          height: `${(el.height / page.height) * 100}%`,
          opacity: el.opacity,
        }
        if (el.type === 'text')
          return <div key={el.id} style={{ ...style, background: el.fill, borderRadius: 1, height: '4%' }} />
        if (el.type === 'image')
          return <div key={el.id} style={{ ...style, background: '#3a3a3a' }} />
        return (
          <div key={el.id} style={{ ...style, background: el.fill, borderRadius: el.type === 'ellipse' ? '50%' : Math.min(3, el.cornerRadius) }} />
        )
      })}
    </div>
  )
}

function SortableThumb({ page, index }: { page: Page; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const selectedPageId = useEditorStore((s) => s.selectedPageId)
  const selectPage = useEditorStore((s) => s.selectPage)
  const ratio = page.height / page.width
  const w = 64
  const h = Math.max(40, Math.min(120, w * ratio))

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative shrink-0 flex flex-col items-center gap-1', isDragging && 'z-10 opacity-80')}
    >
      <button
        onClick={() => selectPage(page.id)}
        {...attributes}
        {...listeners}
        className={cn(
          'relative rounded-md overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]',
          selectedPageId === page.id ? 'border-[#4C9AFF]' : 'border-[#2E2E2E] hover:border-[#454545]',
        )}
        style={{ width: w, height: h }}
        aria-label={`Page ${index + 1}: ${page.name}`}
      >
        <PagePreview page={page} />
        <span className="absolute bottom-0.5 left-0.5 text-[9px] font-mono text-white bg-black/60 rounded px-1 leading-tight">{index + 1}</span>
      </button>
      <span className="text-[9px] text-white/40 max-w-[64px] truncate">{page.name}</span>
    </div>
  )
}

export function TimelineBottom() {
  const pages = useEditorStore((s) => s.pages)
  const order = useEditorStore((s) => s.timelineOrder)
  const reorderPages = useEditorStore((s) => s.reorderPages)
  const addPage = useEditorStore((s) => s.addPage)
  const mergeEpisode = useEditorStore((s) => s.mergeEpisode)
  const toggleTimeline = useEditorStore((s) => s.toggleTimeline)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const leftWidth = useEditorStore((s) => s.leftWidth)
  const rightWidth = useEditorStore((s) => s.rightWidth)
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const rightOpen = useEditorStore((s) => s.rightOpen)
  const timelineHeight = useEditorStore((s) => s.timelineHeight)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    reorderPages(arrayMove(order, oldIndex, newIndex))
  }

  const canvasBox = () => ({
    w: window.innerWidth - (leftOpen ? leftWidth + 12 : 0) - (rightOpen ? rightWidth + 12 : 0),
    h: window.innerHeight - 48 - timelineHeight,
    left: leftOpen ? leftWidth + 12 : 0,
    top: 48,
  })

  const zoomBy = (factor: number) => {
    const { w, h, left, top } = canvasBox()
    const cx = left + w / 2
    const cy = top + h / 2
    const scale = Math.max(0.04, Math.min(viewport.scale * factor, 16))
    const worldX = (cx - viewport.x) / viewport.scale
    const worldY = (cy - viewport.y) / viewport.scale
    setViewport({ x: cx - worldX * scale, y: cy - worldY * scale, scale })
  }

  const fit = () => {
    if (!pages.length) return
    const minX = Math.min(...pages.map((p) => p.x))
    const minY = Math.min(...pages.map((p) => p.y))
    const maxX = Math.max(...pages.map((p) => p.x + p.width))
    const maxY = Math.max(...pages.map((p) => p.y + p.height))
    const { w, h, left, top } = canvasBox()
    const scale = Math.max(0.04, Math.min((w / (maxX - minX)) * 0.9, (h / (maxY - minY)) * 0.9, 4))
    setViewport({
      x: left + (w - (maxX - minX) * scale) / 2 - minX * scale,
      y: top + (h - (maxY - minY) * scale) / 2 - minY * scale,
      scale,
    })
  }

  const ordered = order.map((id) => pages.find((p) => p.id === id)).filter(Boolean) as Page[]

  return (
    <div className="bg-[#141414] border-t border-[#262626] w-full flex flex-col shrink-0" style={{ height: timelineHeight }}>
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={toggleTimeline} aria-label="Collapse timeline" className="text-white/40 hover:text-white">
            <ChevronDown size={15} />
          </button>
          <h2 className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">Story Timeline</h2>
          <span className="text-[10px] text-white/30">{ordered.length} pages</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"><ZoomOut size={14} /></button>
          <span className="text-[11px] font-mono text-white/60 w-11 text-center">{Math.round(viewport.scale * 100)}%</span>
          <button onClick={() => zoomBy(1.2)} aria-label="Zoom in" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"><ZoomIn size={14} /></button>
          <button onClick={fit} aria-label="Zoom to fit" title="Zoom to fit" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"><Maximize size={14} /></button>
          <div className="w-px h-5 bg-[#2E2E2E] mx-1" />
          <button
            onClick={mergeEpisode}
            title="Stack all pages vertically in reading order"
            className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#4C9AFF] to-[#A855F7] text-white text-[11px] font-semibold hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          >
            <GitMerge size={13} /> Merge Episode
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-3 px-4 scrollbar-thin scrollbar-thumb-[#333]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-3">
              {ordered.map((page, i) => (
                <SortableThumb key={page.id} page={page} index={i} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={() => addPage({}, 'webtoon')}
          className="shrink-0 w-16 h-24 border-2 border-dashed border-[#2E2E2E] hover:border-[#4C9AFF] hover:bg-[#4C9AFF]/5 rounded-md flex flex-col items-center justify-center gap-1.5 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
          aria-label="Add page"
        >
          <Plus size={16} className="text-white/40 group-hover:text-[#4C9AFF]" />
          <span className="text-[9px] text-white/40">New page</span>
        </button>
      </div>
    </div>
  )
}
