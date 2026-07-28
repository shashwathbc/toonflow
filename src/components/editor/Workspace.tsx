'use client'

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Stage, Layer, Rect, Ellipse, Text, Group, Line, Shape, Transformer, Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import {
  useEditorStore,
  type Page,
  type EditorElement,
  type ImageElement,
  type TextElement,
  type PaintElement,
  type BubbleElement,
} from '@/store/useEditorStore'
import { registerStage } from '@/lib/editor/exportProject'
import { PageContextMenu } from '@/components/editor/PageContextMenu'
import { BrushEngine, type InputSample } from '@/lib/editor/brush/engine'
import { getPaintCanvas, reconcilePaintCanvas, markPaintSrc } from '@/lib/editor/brush/bitmaps'
import { pathBubble, bubbleTextRect } from '@/lib/editor/bubbles'

const SELECT = '#4C9AFF'

// ---------------------------------------------------------------------------
// Paint node — a raster layer drawn from its live offscreen canvas. The brush
// engine mutates that canvas directly; this node reconciles it from `el.src`
// whenever src changes externally (undo / redo / project load).
// ---------------------------------------------------------------------------
function PaintNode({ el, common }: { el: PaintElement; common: Record<string, unknown> }) {
  const canvas = getPaintCanvas(el.id, el.width, el.height)
  const nodeRef = useRef<Konva.Image>(null)
  useEffect(() => {
    let cancelled = false
    // Redraw imperatively once the canvas matches src — the image object ref is
    // stable across undo/redo, so React alone wouldn't repaint the Konva node.
    const done = () => { if (!cancelled) nodeRef.current?.getLayer()?.batchDraw() }
    const r = reconcilePaintCanvas(el.id, el.src, el.width, el.height)
    if (r) r.then(done)
    else done()
    return () => { cancelled = true }
  }, [el.id, el.src, el.width, el.height])
  return <KonvaImage ref={nodeRef} {...common} image={canvas} width={el.width} height={el.height} />
}

// ---------------------------------------------------------------------------
// Bubble node — a vector speech-bubble outline (by kind) plus its wrapped text,
// grouped so it drags / selects / resizes as one unit. Text is hidden while the
// inline editor is open over it.
// ---------------------------------------------------------------------------
function BubbleNode({
  el, common, beingEdited, onEdit,
}: {
  el: BubbleElement
  common: Record<string, unknown>
  beingEdited: boolean
  onEdit: () => void
}) {
  const tr = bubbleTextRect(el.bubbleType, el.width, el.height)
  return (
    <Group
      {...common}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onEdit() }}
    >
      <Shape
        width={el.width}
        height={el.height}
        sceneFunc={(ctx, shape) => {
          pathBubble(ctx, el.bubbleType, el.width, el.height)
          ctx.fillStrokeShape(shape)
        }}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        dash={el.dashed ? [12, 7] : undefined}
        lineJoin="round"
      />
      <Text
        x={tr.x}
        y={tr.y}
        width={tr.width}
        height={tr.height}
        text={beingEdited ? '' : el.text}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={el.fontStyle}
        fill={el.textColor}
        align={el.align}
        verticalAlign="middle"
        wrap="word"
        listening={false}
      />
    </Group>
  )
}

// ---------------------------------------------------------------------------
// Image node — loads its bitmap through use-image so Konva can paint it.
// ---------------------------------------------------------------------------
function ImageNode({ el, common }: { el: ImageElement; common: Record<string, unknown> }) {
  const [img] = useImage(el.src, el.src?.startsWith('data:') ? undefined : 'anonymous')
  return (
    <Rect
      {...common}
      width={el.width}
      height={el.height}
      fillPatternImage={img ?? undefined}
      fillPatternScaleX={img ? el.width / img.width : 1}
      fillPatternScaleY={img ? el.height / img.height : 1}
      fill={img ? undefined : '#2A2A2A'}
      cornerRadius={2}
    />
  )
}

interface Draft {
  pageId: string
  x: number
  y: number
  w: number
  h: number
}

export function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [guides, setGuides] = useState<number[][]>([]) // world segments [x1,y1,x2,y2]
  const [editing, setEditing] = useState<{ pageId: string; el: EditorElement } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; pageId: string | null } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; left: number; top: number; value: string } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const midPan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const spaceRef = useRef(false)
  // Active brush stroke (paint tools use native pointer events, not Konva mouse).
  const brushRef = useRef<{ engine: BrushEngine; elId: string; pageId: string; canvas: HTMLCanvasElement } | null>(null)

  const pages = useEditorStore((s) => s.pages)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setViewportSize = useEditorStore((s) => s.setViewportSize)
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const selectedPageId = useEditorStore((s) => s.selectedPageId)
  const selectElements = useEditorStore((s) => s.selectElements)
  const selectPage = useEditorStore((s) => s.selectPage)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const addElement = useEditorStore((s) => s.addElement)
  const updateElement = useEditorStore((s) => s.updateElement)
  const updatePage = useEditorStore((s) => s.updatePage)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const gridStyle = useEditorStore((s) => s.gridStyle)
  const showSafeZone = useEditorStore((s) => s.showSafeZone)
  const fitAll = useEditorStore((s) => s.fitAll)
  const fitPage = useEditorStore((s) => s.fitPage)
  const exporting = useEditorStore((s) => s.exporting)

  // ------- container measure ----------------------------------------------
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ width: e.contentRect.width, height: e.contentRect.height })
        setViewportSize(e.contentRect.width, e.contentRect.height)
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [setViewportSize])

  // ------- register stage for export/thumbnails ---------------------------
  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  }, [dims.width, dims.height])

  // ------- cursor "gravity" glow over blank canvas -------------------------
  // A soft light-well follows the pointer. It sits behind the Konva canvas, so
  // it only shows through the empty grid — pages paint over it. Driven by CSS
  // vars on a native listener to avoid a re-render per mouse move.
  useEffect(() => {
    const el = containerRef.current
    const glow = glowRef.current
    if (!el || !glow) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      glow.style.setProperty('--gx', `${e.clientX - r.left}px`)
      glow.style.setProperty('--gy', `${e.clientY - r.top}px`)
      glow.style.opacity = '1'
    }
    const onLeave = () => {
      glow.style.opacity = '0'
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ------- space-to-pan ----------------------------------------------------
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target) && !editing) {
        e.preventDefault()
        spaceRef.current = true
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        setSpaceDown(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [editing])

  // ------- attach transformer to selected nodes ---------------------------
  useEffect(() => {
    const stage = stageRef.current
    const tr = trRef.current
    if (!stage || !tr) return
    // No transform handles while a paint tool is active — they'd box the
    // full-page layer and get in the way of drawing.
    const paintTool = activeTool === 'brush' || activeTool === 'eraser'
    const nodes = paintTool
      ? []
      : selectedElementIds
          .map((id) => stage.findOne('#' + id))
          .filter((n): n is Konva.Node => Boolean(n))
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedElementIds, pages, editing, activeTool])

  // ------- brush / eraser painting (native pointer events) ------------------
  // Paint tools use raw PointerEvents (not Konva's mouse events) so strokes get
  // pen pressure and coalesced sub-frame samples — tablet-grade input from
  // Wacom / Huion / XP-Pen / Apple Pencil / Surface Pen via the standard API.
  useEffect(() => {
    if (activeTool !== 'brush' && activeTool !== 'eraser') return
    const el = containerRef.current
    if (!el) return

    const pressureOf = (ev: PointerEvent) =>
      ev.pointerType === 'mouse' ? 0.5 : ev.pressure > 0 ? ev.pressure : 0.5

    const toWorldPt = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      const vp = useEditorStore.getState().viewport
      return { x: (clientX - rect.left - vp.x) / vp.scale, y: (clientY - rect.top - vp.y) / vp.scale }
    }

    const pageAtWorld = (wx: number, wy: number): Page | null => {
      const ps = useEditorStore.getState().pages
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        if (wx >= p.x && wx <= p.x + p.width && wy >= p.y && wy <= p.y + p.height) return p
      }
      return null
    }

    // Coalesce redraws to one per animation frame. pointermove (with coalesced
    // samples) fires far faster than 60fps; calling batchDraw on every event is
    // what made strokes feel janky. The engine still ingests every sample.
    let raf: number | null = null
    const scheduleRedraw = () => {
      if (raf != null) return
      raf = requestAnimationFrame(() => { raf = null; stageRef.current?.batchDraw() })
    }

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || spaceRef.current) return
      const st = useEditorStore.getState()
      if (st.activeTool !== 'brush' && st.activeTool !== 'eraser') return
      const w = toWorldPt(ev.clientX, ev.clientY)
      const page = pageAtWorld(w.x, w.y)
      if (!page) return
      ev.preventDefault()
      el.setPointerCapture?.(ev.pointerId)

      // Target the selected paint layer on this page, else its topmost paint
      // layer, else create a fresh one (so we don't spawn a layer per stroke).
      const paints = page.elements.filter((e): e is PaintElement => e.type === 'paint')
      let target = paints.find((e) => st.selectedElementIds.includes(e.id)) ?? paints[paints.length - 1]
      if (!target) {
        const id = st.addPaintLayer(page.id) // pushes history + selects
        target = useEditorStore.getState().pages
          .find((p) => p.id === page.id)!
          .elements.find((e) => e.id === id) as PaintElement
      } else {
        st.selectElements([target.id])
        st.pushHistory() // snapshot pre-stroke src for undo
      }

      const canvas = getPaintCanvas(target.id, page.width, page.height)
      const engine = new BrushEngine(canvas, { ...st.brush }, st.activeTool === 'eraser')
      brushRef.current = { engine, elId: target.id, pageId: page.id, canvas }
      engine.begin({ x: w.x - page.x, y: w.y - page.y, pressure: pressureOf(ev) })
      scheduleRedraw()
    }

    const onMove = (ev: PointerEvent) => {
      const cur = brushRef.current
      if (!cur) return
      const page = useEditorStore.getState().pages.find((p) => p.id === cur.pageId)
      if (!page) return
      const raw = (ev.getCoalescedEvents?.() as PointerEvent[] | undefined) ?? [ev]
      const samples: InputSample[] = raw.map((pe) => {
        const w = toWorldPt(pe.clientX, pe.clientY)
        return { x: w.x - page.x, y: w.y - page.y, pressure: pressureOf(pe) }
      })
      cur.engine.extend(samples)
      scheduleRedraw()
    }

    const finish = (ev: PointerEvent) => {
      const cur = brushRef.current
      if (!cur) return
      brushRef.current = null
      cur.engine.end()
      const url = cur.canvas.toDataURL('image/png')
      markPaintSrc(cur.elId, url) // we produced these pixels — don't reload them
      useEditorStore.getState().updateElement(cur.pageId, cur.elId, { src: url }, false)
      el.releasePointerCapture?.(ev.pointerId)
      if (raf != null) { cancelAnimationFrame(raf); raf = null }
      stageRef.current?.batchDraw()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
    return () => {
      if (raf != null) cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
    }
  }, [activeTool])

  // ------- coordinate helpers ---------------------------------------------
  const toWorld = useCallback(
    (px: number, py: number) => ({
      x: (px - viewport.x) / viewport.scale,
      y: (py - viewport.y) / viewport.scale,
    }),
    [viewport],
  )

  const pageAt = useCallback(
    (wx: number, wy: number): Page | null => {
      for (let i = pages.length - 1; i >= 0; i--) {
        const p = pages[i]
        if (wx >= p.x && wx <= p.x + p.width && wy >= p.y && wy <= p.y + p.height) return p
      }
      return null
    },
    [pages],
  )

  // ------- wheel: Figma-style scroll-to-pan --------------------------------
  // Two-finger trackpad scroll (or a mouse wheel) PANS in any direction.
  // Pinch — which browsers report as ctrlKey — and ⌘/Ctrl+wheel ZOOM toward the
  // cursor. Shift turns a vertical-only wheel into horizontal panning.
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const { ctrlKey, metaKey, shiftKey, deltaX, deltaY } = e.evt

    if (ctrlKey || metaKey) {
      const oldScale = viewport.scale
      // Clamp so a chunky mouse wheel (deltaY ≈ ±100) doesn't jump zoom levels
      // while a trackpad pinch (deltaY ≈ ±5) stays smooth.
      const dz = Math.max(-40, Math.min(40, deltaY))
      const scale = Math.max(0.02, Math.min(oldScale * Math.exp(-dz * 0.01), 16))
      const worldX = (pointer.x - viewport.x) / oldScale
      const worldY = (pointer.y - viewport.y) / oldScale
      setViewport({ x: pointer.x - worldX * scale, y: pointer.y - worldY * scale, scale })
      return
    }

    const panX = shiftKey && deltaX === 0 ? deltaY : deltaX
    const panY = shiftKey && deltaX === 0 ? 0 : deltaY
    setViewport({ x: viewport.x - panX, y: viewport.y - panY, scale: viewport.scale })
  }

  const panning = spaceDown || activeTool === 'hand'

  // ------- pointer down on stage ------------------------------------------
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    // Right-click is handled by the container's context menu, not selection.
    if (e.evt.button === 2) return
    // Middle-mouse drag pans from anywhere, regardless of active tool.
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      midPan.current = { sx: pointer.x, sy: pointer.y, vx: viewport.x, vy: viewport.y }
      return
    }
    if (panning) return
    // Paint tools are handled by native pointer listeners (for pressure), so the
    // Konva mouse path must not also marquee/select.
    if (activeTool === 'brush' || activeTool === 'eraser') return
    const w = toWorld(pointer.x, pointer.y)
    const targetIsStage = e.target === stage
    const onArtboard = e.target.name() === 'artboard'

    // creation tools
    if (activeTool === 'rect' || activeTool === 'ellipse') {
      const page = pageAt(w.x, w.y)
      if (page) {
        startRef.current = w
        setDraft({ pageId: page.id, x: w.x - page.x, y: w.y - page.y, w: 0, h: 0 })
      }
      return
    }
    if (activeTool === 'text') {
      const page = pageAt(w.x, w.y)
      if (page) {
        const st = useEditorStore.getState()
        const kind = st.pendingBubbleKind
        const id = kind
          ? st.addBubble(page.id, kind, Math.round(w.x - page.x), Math.round(w.y - page.y))
          : addElement(page.id, { type: 'text', x: w.x - page.x, y: w.y - page.y })
        if (kind) st.setPendingBubbleKind(null)
        const created = useEditorStore.getState().pages.find((p) => p.id === page.id)?.elements.find((el) => el.id === id)
        setActiveTool('select')
        if (created) setEditing({ pageId: page.id, el: created })
      }
      return
    }
    if (activeTool === 'frame') {
      useEditorStore.getState().addPage({ x: Math.round(w.x), y: Math.round(w.y) })
      setActiveTool('select')
      return
    }

    // select tool: marquee from empty space, page-select from artboard bg
    if (activeTool === 'select') {
      if (targetIsStage) {
        clearSelection()
        selectPage(null)
        startRef.current = w
        setMarquee({ x: w.x, y: w.y, w: 0, h: 0 })
      } else if (onArtboard) {
        const id = e.target.id()
        selectPage(id)
      }
    }
  }

  const handleMouseMove = () => {
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    if (midPan.current) {
      setViewport({
        x: midPan.current.vx + (pointer.x - midPan.current.sx),
        y: midPan.current.vy + (pointer.y - midPan.current.sy),
        scale: viewport.scale,
      })
      return
    }
    if (!startRef.current) return
    const w = toWorld(pointer.x, pointer.y)
    const s = startRef.current
    if (draft) {
      const page = pages.find((p) => p.id === draft.pageId)
      if (!page) return
      const x = Math.min(w.x, s.x) - page.x
      const y = Math.min(w.y, s.y) - page.y
      setDraft({ pageId: draft.pageId, x, y, w: Math.abs(w.x - s.x), h: Math.abs(w.y - s.y) })
    } else if (marquee) {
      setMarquee({ x: Math.min(w.x, s.x), y: Math.min(w.y, s.y), w: Math.abs(w.x - s.x), h: Math.abs(w.y - s.y) })
    }
  }

  const handleMouseUp = () => {
    if (draft) {
      if (draft.w > 4 && draft.h > 4) {
        addElement(draft.pageId, {
          type: activeTool === 'ellipse' ? 'ellipse' : 'rect',
          x: draft.x,
          y: draft.y,
          width: draft.w,
          height: draft.h,
        })
        setActiveTool('select')
      }
      setDraft(null)
    }
    if (marquee) {
      if (marquee.w > 3 && marquee.h > 3) {
        const hits: string[] = []
        for (const p of pages) {
          for (const el of p.elements) {
            if (el.isHidden) continue
            const ax = p.x + el.x
            const ay = p.y + el.y
            if (
              ax < marquee.x + marquee.w &&
              ax + el.width > marquee.x &&
              ay < marquee.y + marquee.h &&
              ay + el.height > marquee.y
            )
              hits.push(el.id)
          }
        }
        if (hits.length) selectElements(hits)
      }
      setMarquee(null)
    }
    startRef.current = null
    midPan.current = null
  }

  // Double-click empty canvas → fit all; on a page → zoom to that page.
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const w = toWorld(pointer.x, pointer.y)
    const page = pageAt(w.x, w.y)
    if (page && e.target.name() !== 'element') fitPage(page.id)
    else if (!page) fitAll()
  }

  // Custom right-click menu on pages (replaces the browser default over canvas).
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const page = pageAt(w.x, w.y)
    if (page) selectPage(page.id)
    setCtxMenu({ x: e.clientX, y: e.clientY, pageId: page ? page.id : null })
  }

  const startRename = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId)
    if (!page) return
    setRenaming({
      id: pageId,
      left: page.x * viewport.scale + viewport.x,
      top: page.y * viewport.scale + viewport.y - 28,
      value: page.name,
    })
  }

  const commitRename = () => {
    setRenaming((r) => {
      if (r) {
        const v = r.value.trim()
        if (v) updatePage(r.id, { name: v }, true)
      }
      return null
    })
  }

  // ------- element drag with edge snapping --------------------------------
  const onElDragMove = (e: Konva.KonvaEventObject<DragEvent>, page: Page, el: EditorElement) => {
    const node = e.target
    const isEllipse = el.type === 'ellipse'
    let left = isEllipse ? node.x() - el.width / 2 : node.x()
    let top = isEllipse ? node.y() - el.height / 2 : node.y()
    const segs: number[][] = []

    if (snapEnabled) {
      const T = 6 / viewport.scale
      type Tgt = { pos: number; a: number; b: number }
      // page edges + center, then every sibling's edges + center
      const xT: Tgt[] = [
        { pos: 0, a: 0, b: page.height },
        { pos: page.width / 2, a: 0, b: page.height },
        { pos: page.width, a: 0, b: page.height },
      ]
      const yT: Tgt[] = [
        { pos: 0, a: 0, b: page.width },
        { pos: page.height / 2, a: 0, b: page.width },
        { pos: page.height, a: 0, b: page.width },
      ]
      for (const s of page.elements) {
        if (s.id === el.id || s.isHidden) continue
        xT.push({ pos: s.x, a: s.y, b: s.y + s.height }, { pos: s.x + s.width / 2, a: s.y, b: s.y + s.height }, { pos: s.x + s.width, a: s.y, b: s.y + s.height })
        yT.push({ pos: s.y, a: s.x, b: s.x + s.width }, { pos: s.y + s.height / 2, a: s.x, b: s.x + s.width }, { pos: s.y + s.height, a: s.x, b: s.x + s.width })
      }

      let bestX: { d: number; t: Tgt } | null = null
      for (const o of [0, el.width / 2, el.width])
        for (const t of xT) {
          const d = t.pos - (left + o)
          if (Math.abs(d) <= T && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, t }
        }
      if (bestX) {
        left += bestX.d
        segs.push([page.x + bestX.t.pos, page.y + Math.min(bestX.t.a, top), page.x + bestX.t.pos, page.y + Math.max(bestX.t.b, top + el.height)])
      }

      let bestY: { d: number; t: Tgt } | null = null
      for (const o of [0, el.height / 2, el.height])
        for (const t of yT) {
          const d = t.pos - (top + o)
          if (Math.abs(d) <= T && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, t }
        }
      if (bestY) {
        top += bestY.d
        segs.push([page.x + Math.min(bestY.t.a, left), page.y + bestY.t.pos, page.x + Math.max(bestY.t.b, left + el.width), page.y + bestY.t.pos])
      }
    }

    node.x(isEllipse ? left + el.width / 2 : left)
    node.y(isEllipse ? top + el.height / 2 : top)
    setGuides(segs)
  }

  const onElDragEnd = (e: Konva.KonvaEventObject<DragEvent>, page: Page, el: EditorElement) => {
    const node = e.target
    const isEllipse = el.type === 'ellipse'
    updateElement(page.id, el.id, {
      x: Math.round(isEllipse ? node.x() - el.width / 2 : node.x()),
      y: Math.round(isEllipse ? node.y() - el.height / 2 : node.y()),
    })
    setGuides([])
  }

  const onElTransformEnd = (e: Konva.KonvaEventObject<Event>, page: Page, el: EditorElement) => {
    const node = e.target
    const sx = node.scaleX()
    const sy = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const width = Math.max(5, Math.round(node.width() * sx))
    const height = Math.max(5, Math.round(node.height() * sy))
    const isEllipse = el.type === 'ellipse'
    const patch: Partial<EditorElement> = {
      width,
      height,
      x: Math.round(isEllipse ? node.x() - width / 2 : node.x()),
      y: Math.round(isEllipse ? node.y() - height / 2 : node.y()),
      rotation: Math.round(node.rotation()),
    }
    if (el.type === 'text') (patch as Partial<TextElement>).fontSize = Math.max(6, Math.round(el.fontSize * sy))
    if (el.type === 'bubble') (patch as Partial<BubbleElement>).fontSize = Math.max(8, Math.round(el.fontSize * ((sx + sy) / 2)))
    updateElement(page.id, el.id, patch)
  }

  // ------- render one element ---------------------------------------------
  const renderElement = (page: Page, el: EditorElement) => {
    if (el.isHidden) return null
    // Text elements vanish behind the inline editor; bubbles stay (only their
    // text is blanked) so the outline is visible while you type.
    if (editing && editing.el.id === el.id && el.type === 'text') return null
    const draggable = activeTool === 'select' && !el.isLocked && !panning
    const common = {
      id: el.id,
      name: 'element',
      opacity: el.opacity,
      globalCompositeOperation: el.blendMode ?? undefined,
      rotation: el.rotation,
      draggable,
      onMouseDown: (ev: Konva.KonvaEventObject<MouseEvent>) => {
        if (activeTool !== 'select' || panning) return
        ev.cancelBubble = true
        if (!selectedElementIds.includes(el.id)) selectElements([el.id], ev.evt.shiftKey)
        else if (ev.evt.shiftKey) selectElements([el.id], true)
      },
      onDragStart: () => {
        pushHistory()
        if (!selectedElementIds.includes(el.id)) selectElements([el.id])
      },
      onDragMove: (ev: Konva.KonvaEventObject<DragEvent>) => onElDragMove(ev, page, el),
      onDragEnd: (ev: Konva.KonvaEventObject<DragEvent>) => onElDragEnd(ev, page, el),
      onTransformStart: () => pushHistory(),
      onTransformEnd: (ev: Konva.KonvaEventObject<Event>) => onElTransformEnd(ev, page, el),
    }

    if (el.type === 'rect') {
      return <Rect key={el.id} {...common} x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} stroke={el.strokeWidth ? el.stroke : undefined} strokeWidth={el.strokeWidth} cornerRadius={el.cornerRadius} />
    }
    if (el.type === 'ellipse') {
      return <Ellipse key={el.id} {...common} x={el.x + el.width / 2} y={el.y + el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} fill={el.fill} stroke={el.strokeWidth ? el.stroke : undefined} strokeWidth={el.strokeWidth} />
    }
    if (el.type === 'text') {
      return (
        <Text
          key={el.id}
          {...common}
          x={el.x}
          y={el.y}
          width={el.width}
          text={el.text}
          fontSize={el.fontSize}
          fontFamily={el.fontFamily}
          fontStyle={el.fontStyle}
          fill={el.fill}
          align={el.align}
          lineHeight={el.lineHeight}
          onDblClick={(ev) => { ev.cancelBubble = true; setEditing({ pageId: page.id, el }) }}
        />
      )
    }
    if (el.type === 'image') {
      return <ImageNode key={el.id} el={el} common={{ ...common, x: el.x, y: el.y }} />
    }
    if (el.type === 'paint') {
      return <PaintNode key={el.id} el={el} common={{ ...common, x: el.x, y: el.y }} />
    }
    if (el.type === 'bubble') {
      return (
        <BubbleNode
          key={el.id}
          el={el}
          common={common}
          beingEdited={!!editing && editing.el.id === el.id}
          onEdit={() => setEditing({ pageId: page.id, el })}
        />
      )
    }
    return null
  }

  // ------- inline text editor overlay -------------------------------------
  const editorBox = editing
    ? (() => {
        const page = pages.find((p) => p.id === editing.pageId)
        const el = page?.elements.find((e) => e.id === editing.el.id)
        if (!page || !el) return null
        if (el.type === 'text') {
          return {
            page, elId: el.id,
            screenX: (page.x + el.x) * viewport.scale + viewport.x,
            screenY: (page.y + el.y) * viewport.scale + viewport.y,
            width: el.width, fontSize: el.fontSize, fontFamily: el.fontFamily,
            color: el.fill, lineHeight: el.lineHeight, align: el.align, text: el.text,
          }
        }
        if (el.type === 'bubble') {
          const t = bubbleTextRect(el.bubbleType, el.width, el.height)
          return {
            page, elId: el.id,
            screenX: (page.x + el.x + t.x) * viewport.scale + viewport.x,
            screenY: (page.y + el.y + t.y) * viewport.scale + viewport.y,
            width: t.width, fontSize: el.fontSize, fontFamily: el.fontFamily,
            color: el.textColor, lineHeight: 1.2, align: el.align, text: el.text,
          }
        }
        return null
      })()
    : null

  // ------- viewport culling: only mount pages intersecting the view ---------
  const M = 300
  const view = {
    minX: -viewport.x / viewport.scale - M,
    minY: -viewport.y / viewport.scale - M,
    maxX: (dims.width - viewport.x) / viewport.scale + M,
    maxY: (dims.height - viewport.y) / viewport.scale + M,
  }
  // During export/publish, render every page (even off-screen) so their nodes
  // exist to be rasterized; otherwise cull to the viewport for performance.
  const visiblePages = exporting
    ? pages
    : pages.filter(
        (p) => p.x < view.maxX && p.x + p.width > view.minX && p.y < view.maxY && p.y + p.height > view.minY,
      )

  // ------- seamless column detection ---------------------------------------
  // Pages sharing a left edge + width and stacked with no gap are drawn as one
  // continuous strip: the touching edges lose their label, shadow and rounded
  // corners so a merged episode reads as a single long vertical page.
  const columnEdges = useMemo(() => {
    const EPS = 1.5
    const above = new Set<string>() // has a contiguous page directly above
    const below = new Set<string>() // has a contiguous page directly below
    for (const p of pages) {
      for (const o of pages) {
        if (o.id === p.id) continue
        if (Math.abs(o.x - p.x) > EPS || Math.abs(o.width - p.width) > EPS) continue
        if (Math.abs(o.y + o.height - p.y) < EPS) above.add(p.id)
        if (Math.abs(p.y + p.height - o.y) < EPS) below.add(p.id)
      }
    }
    return { above, below }
  }, [pages])

  // ------- grid background --------------------------------------------------
  const g = 24 * viewport.scale
  const gridBg: React.CSSProperties | undefined =
    gridStyle === 'none'
      ? undefined
      : gridStyle === 'lines'
        ? {
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: `${g}px ${g}px, ${g}px ${g}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }
        : {
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: `${g}px ${g}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#0C0C0C] relative overflow-hidden"
      style={{ cursor: panning ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair' }}
      onContextMenu={handleContextMenu}
    >
      {/* infinite grid background */}
      {gridBg && <div className="absolute inset-0 pointer-events-none" style={gridBg} />}

      {/* cursor gravity glow — behind the Konva canvas, shows only over blank space */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle 240px at var(--gx, 50%) var(--gy, 50%), rgba(76,154,255,0.16), rgba(76,154,255,0.05) 42%, transparent 70%)',
        }}
      />

      {dims.width > 0 && (
        <Stage
          ref={stageRef}
          width={dims.width}
          height={dims.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onWheel={handleWheel}
          draggable={panning}
          onDragEnd={(e) => {
            if (e.target === stageRef.current)
              setViewport({ x: e.target.x(), y: e.target.y(), scale: viewport.scale })
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDblClick={handleDblClick}
        >
          <Layer>
            {visiblePages.map((page) => {
              const selPage = selectedPageId === page.id
              const movable = activeTool === 'select' && selPage && !page.isLocked && !panning
              const hasAbove = columnEdges.above.has(page.id)
              const hasBelow = columnEdges.below.has(page.id)
              const inColumn = hasAbove || hasBelow
              // Corner order: [topLeft, topRight, bottomRight, bottomLeft].
              const radius: number | number[] = inColumn
                ? [hasAbove ? 0 : 2, hasAbove ? 0 : 2, hasBelow ? 0 : 2, hasBelow ? 0 : 2]
                : 2
              return (
                <Group
                  key={page.id}
                  id={'page-' + page.id}
                  x={page.x}
                  y={page.y}
                  draggable={movable}
                  onDragStart={() => pushHistory()}
                  onDragEnd={(e) => {
                    if (e.target === e.currentTarget)
                      updatePage(page.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) }, false)
                  }}
                >
                  {/* Only the top page of a contiguous column keeps a label, so
                      the merged strip reads as one page rather than many. */}
                  {!hasAbove && (
                    <Text text={page.name} x={0} y={-26 / viewport.scale} fontSize={13 / viewport.scale} fill={selPage ? SELECT : '#8B8B8B'} fontFamily="Inter" listening={false} />
                  )}
                  <Rect name="artboard" id={page.id} x={0} y={0} width={page.width} height={page.height} fill={page.backgroundColor} cornerRadius={radius} shadowColor="black" shadowBlur={inColumn ? 0 : 24} shadowOpacity={inColumn ? 0 : 0.55} shadowOffset={{ x: 0, y: inColumn ? 0 : 12 }} stroke={selPage ? SELECT : undefined} strokeWidth={selPage ? 1.5 / viewport.scale : 0} />
                  <Group clipX={0} clipY={0} clipWidth={page.width} clipHeight={page.height}>
                    {page.elements.map((el) => renderElement(page, el))}
                  </Group>
                  {showSafeZone && (
                    <Rect
                      x={page.width * 0.05}
                      y={page.height * 0.04}
                      width={page.width * 0.9}
                      height={page.height * 0.92}
                      stroke="#22C55E"
                      strokeWidth={1 / viewport.scale}
                      dash={[8 / viewport.scale, 6 / viewport.scale]}
                      listening={false}
                    />
                  )}
                </Group>
              )
            })}

            {/* smart guides (pink) */}
            {guides.map((seg, i) => (
              <Line key={'g' + i} points={seg} stroke="#FF3B6B" strokeWidth={1 / viewport.scale} listening={false} />
            ))}

            {/* creation preview */}
            {draft && (() => {
              const page = pages.find((p) => p.id === draft.pageId)
              if (!page) return null
              return <Rect x={page.x + draft.x} y={page.y + draft.y} width={draft.w} height={draft.h} fill={`${SELECT}22`} stroke={SELECT} strokeWidth={1 / viewport.scale} listening={false} />
            })()}

            {/* marquee */}
            {marquee && <Rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill={`${SELECT}18`} stroke={SELECT} strokeWidth={1 / viewport.scale} listening={false} />}

            <Transformer
              ref={trRef}
              rotateEnabled
              borderStroke={SELECT}
              borderStrokeWidth={1.5 / viewport.scale}
              anchorStroke={SELECT}
              anchorFill="#fff"
              anchorSize={8 / viewport.scale}
              anchorCornerRadius={2}
              rotateAnchorOffset={22 / viewport.scale}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>
      )}

      {/* inline text editor */}
      {editorBox && (
        <textarea
          autoFocus
          className="absolute z-40 resize-none bg-transparent outline outline-2 outline-[#4C9AFF] p-0 leading-tight"
          style={{
            left: editorBox.screenX,
            top: editorBox.screenY,
            width: editorBox.width * viewport.scale,
            minHeight: editorBox.fontSize * viewport.scale,
            fontSize: editorBox.fontSize * viewport.scale,
            fontFamily: editorBox.fontFamily,
            color: editorBox.color,
            lineHeight: editorBox.lineHeight,
            textAlign: editorBox.align,
          }}
          defaultValue={editorBox.text}
          onBlur={(e) => {
            updateElement(editorBox.page.id, editorBox.elId, { text: e.target.value }, true)
            setEditing(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.currentTarget.blur()
            }
            e.stopPropagation()
          }}
        />
      )}

      {/* page rename input */}
      {renaming && (
        <input
          autoFocus
          value={renaming.value}
          onChange={(e) => setRenaming((r) => (r ? { ...r, value: e.target.value } : r))}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape') setRenaming(null)
            e.stopPropagation()
          }}
          style={{ left: renaming.left, top: renaming.top }}
          className="absolute z-40 bg-[#1E1E1E] border border-[#4C9AFF] text-white text-xs px-1.5 py-0.5 rounded outline-none"
          aria-label="Rename page"
        />
      )}

      {/* right-click page menu */}
      {ctxMenu && (
        <PageContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          pageId={ctxMenu.pageId}
          onClose={() => setCtxMenu(null)}
          onRename={startRename}
        />
      )}
    </div>
  )
}
