'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapIcon, X } from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'

const W = 208
const H = 132
const PAD = 10

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<{ k: number; ox: number; oy: number; minX: number; minY: number } | null>(null)
  const dragging = useRef(false)
  const [open, setOpen] = useState(true)

  const pages = useEditorStore((s) => s.pages)
  const viewport = useEditorStore((s) => s.viewport)
  const viewportSize = useEditorStore((s) => s.viewportSize)
  const setViewport = useEditorStore((s) => s.setViewport)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    if (!viewportSize.width) return

    const vw = {
      minX: -viewport.x / viewport.scale,
      minY: -viewport.y / viewport.scale,
      maxX: (viewportSize.width - viewport.x) / viewport.scale,
      maxY: (viewportSize.height - viewport.y) / viewport.scale,
    }
    let b = pages.length
      ? {
          minX: Math.min(...pages.map((p) => p.x)),
          minY: Math.min(...pages.map((p) => p.y)),
          maxX: Math.max(...pages.map((p) => p.x + p.width)),
          maxY: Math.max(...pages.map((p) => p.y + p.height)),
        }
      : { ...vw }
    b = {
      minX: Math.min(b.minX, vw.minX),
      minY: Math.min(b.minY, vw.minY),
      maxX: Math.max(b.maxX, vw.maxX),
      maxY: Math.max(b.maxY, vw.maxY),
    }
    const bw = Math.max(1, b.maxX - b.minX)
    const bh = Math.max(1, b.maxY - b.minY)
    const k = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh)
    const ox = (W - bw * k) / 2
    const oy = (H - bh * k) / 2
    mapRef.current = { k, ox, oy, minX: b.minX, minY: b.minY }
    const mx = (x: number) => ox + (x - b.minX) * k
    const my = (y: number) => oy + (y - b.minY) * k

    for (const p of pages) {
      ctx.fillStyle = '#3a3a40'
      ctx.fillRect(mx(p.x), my(p.y), Math.max(1, p.width * k), Math.max(1, p.height * k))
    }
    ctx.fillStyle = 'rgba(76,154,255,0.16)'
    ctx.strokeStyle = '#4C9AFF'
    ctx.lineWidth = 1.5
    const rx = mx(vw.minX)
    const ry = my(vw.minY)
    ctx.fillRect(rx, ry, (vw.maxX - vw.minX) * k, (vw.maxY - vw.minY) * k)
    ctx.strokeRect(rx, ry, (vw.maxX - vw.minX) * k, (vw.maxY - vw.minY) * k)
  }, [pages, viewport, viewportSize, open])

  const recenter = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      const m = mapRef.current
      if (!canvas || !m || !viewportSize.width) return
      const rect = canvas.getBoundingClientRect()
      const worldX = m.minX + (clientX - rect.left - m.ox) / m.k
      const worldY = m.minY + (clientY - rect.top - m.oy) / m.k
      const scale = viewport.scale
      setViewport({ x: viewportSize.width / 2 - worldX * scale, y: viewportSize.height / 2 - worldY * scale, scale })
    },
    [viewportSize, viewport.scale, setViewport],
  )

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show navigator"
        className="absolute bottom-4 right-4 z-30 w-9 h-9 flex items-center justify-center rounded-lg bg-[#1B1B1B]/95 backdrop-blur-xl border border-[#2E2E2E] text-white/60 hover:text-white shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]"
      >
        <MapIcon size={16} />
      </button>
    )

  return (
    <div className="absolute bottom-4 right-4 z-30 rounded-xl bg-[#1B1B1B]/95 backdrop-blur-xl border border-[#2E2E2E] shadow-2xl overflow-hidden">
      <div className="h-7 px-2.5 flex items-center justify-between border-b border-[#2A2A2A]">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Navigator</span>
        <button onClick={() => setOpen(false)} aria-label="Hide navigator" className="text-white/40 hover:text-white">
          <X size={12} />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H }}
        className="cursor-pointer block"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          recenter(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (dragging.current) recenter(e.clientX, e.clientY)
        }}
        onPointerUp={() => (dragging.current = false)}
      />
    </div>
  )
}
