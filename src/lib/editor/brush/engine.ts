// ---------------------------------------------------------------------------
// BrushEngine — a framework-agnostic raster stroke engine.
//
// It paints onto a plain <canvas> in that canvas's own pixel space, so it is
// independent of React, Konva, zoom or pan (the caller converts screen input to
// layer-local coordinates). One instance handles exactly one stroke.
//
// Technique (how a real painting app does it):
//  • Dabs, not lines. A stroke is a dense run of soft circular STAMPS spaced by
//    `spacing × size`, with position + pressure interpolated between input
//    samples, so lines stay smooth at any speed.
//  • Flow vs. opacity. Dabs accumulate on a separate `stroke` buffer at `flow`
//    alpha (buildup within the stroke), then the whole buffer is composited onto
//    the layer at `opacity`. That caps a stroke at its opacity no matter how many
//    times it overlaps itself — the thing naive per-dab alpha gets wrong.
//  • Pressure. Pen pressure drives size and opacity via `sizePressure` /
//    `opacityPressure`. Works for Wacom / Huion / XP-Pen / Apple Pencil /
//    Surface Pen because they all report through the standard PointerEvent.
//  • Stabilization smooths the input; scatter jitters dabs for dry media.
//
// Erasers reuse the exact same pipeline: same dabs/buffer, but the final
// composite uses 'destination-out' so the stroke removes alpha instead of adding
// ink. Hardness/opacity/flow therefore give soft/hard/partial erasing for free.
// ---------------------------------------------------------------------------

import type { BrushSettings } from './presets'

const TAU = Math.PI * 2

export interface InputSample {
  x: number // layer-local px
  y: number
  pressure: number // 0..1
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height)
  c.getContext('2d')!.drawImage(src, 0, 0)
  return c
}

/**
 * Pre-render one soft circular dab at a reference resolution. The gradient is
 * solid to `hardness` of the radius then fades to transparent, giving the crisp
 * (hard) or feathered (soft) edge. Built once per stroke and scaled per dab.
 */
function makeStamp(resolution: number, hardness: number, color: string): HTMLCanvasElement {
  const d = Math.max(2, Math.round(resolution))
  const c = makeCanvas(d, d)
  const ctx = c.getContext('2d')!
  const r = d / 2
  const { r: rr, g: gg, b: bb } = hexToRgb(color)
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  const core = clamp01(hardness) * 0.98
  grad.addColorStop(0, `rgba(${rr},${gg},${bb},1)`)
  grad.addColorStop(core, `rgba(${rr},${gg},${bb},1)`)
  grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(r, r, r, 0, TAU)
  ctx.fill()
  return c
}

export class BrushEngine {
  private readonly ctx: CanvasRenderingContext2D
  private readonly w: number
  private readonly h: number
  private readonly s: BrushSettings
  private readonly erase: boolean

  private readonly base: HTMLCanvasElement // layer pixels before this stroke
  private readonly stroke: HTMLCanvasElement // this stroke's accumulation buffer
  private readonly strokeCtx: CanvasRenderingContext2D
  private readonly stamp: HTMLCanvasElement // cached soft dab

  private last: InputSample | null = null
  private smooth: InputSample | null = null
  private offset = 0 // distance until the next dab (carried across samples)
  private active = false

  constructor(layer: HTMLCanvasElement, settings: BrushSettings, erase = false) {
    this.ctx = layer.getContext('2d')!
    this.w = layer.width
    this.h = layer.height
    this.s = settings
    this.erase = erase
    this.base = cloneCanvas(layer)
    this.stroke = makeCanvas(this.w, this.h)
    this.strokeCtx = this.stroke.getContext('2d')!
    const res = Math.min(256, Math.max(16, Math.ceil(settings.size)))
    // Eraser masks alpha, so its stamp colour is irrelevant — use white.
    this.stamp = makeStamp(res, settings.hardness, erase ? '#ffffff' : settings.color)
  }

  begin(p: InputSample) {
    this.active = true
    this.smooth = { ...p }
    this.last = { ...p }
    this.offset = 0
    this.dab(p.x, p.y, p.pressure)
    this.offset = this.step()
    this.composite()
  }

  /** Feed one or more (typically coalesced) input samples. */
  extend(points: InputSample[]) {
    if (!this.active || !this.last || !this.smooth) return
    const follow = 1 - clamp01(this.s.stabilization) * 0.85
    for (const raw of points) {
      const cur: InputSample = {
        x: this.smooth.x + (raw.x - this.smooth.x) * follow,
        y: this.smooth.y + (raw.y - this.smooth.y) * follow,
        pressure: this.smooth.pressure + (raw.pressure - this.smooth.pressure) * follow,
      }
      this.smooth = cur
      this.stampSegment(this.last, cur)
      this.last = cur
    }
    this.composite()
  }

  end() {
    if (this.active) this.composite() // ensure the final pixels are baked in
    this.active = false
    this.last = null
    this.smooth = null
  }

  // --- internals ----------------------------------------------------------

  private step() {
    return Math.max(0.5, this.s.spacing * this.s.size)
  }

  private sizeAt(pressure: number) {
    const scale = 1 - clamp01(this.s.sizePressure) * (1 - clamp01(pressure))
    return this.s.size * scale
  }

  private flowAt(pressure: number) {
    const pf = 1 - clamp01(this.s.opacityPressure) * (1 - clamp01(pressure))
    return clamp01(this.s.flow) * pf
  }

  private stampSegment(a: InputSample, b: InputSample) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    const step = this.step()
    let o = this.offset
    if (dist < 1e-3) {
      this.offset = Math.max(0, o - dist)
      return
    }
    while (o <= dist) {
      const t = o / dist
      const pr = a.pressure + (b.pressure - a.pressure) * t
      this.dab(a.x + dx * t, a.y + dy * t, pr)
      o += step
    }
    this.offset = o - dist
  }

  private dab(x: number, y: number, pressure: number) {
    const size = this.sizeAt(pressure)
    if (size < 0.4) return
    let px = x
    let py = y
    if (this.s.scatter > 0) {
      const rad = this.s.scatter * this.s.size
      const ang = Math.random() * TAU
      const rr = Math.random() * rad
      px += Math.cos(ang) * rr
      py += Math.sin(ang) * rr
    }
    const ctx = this.strokeCtx
    ctx.globalAlpha = clamp01(this.flowAt(pressure))
    ctx.drawImage(this.stamp, px - size / 2, py - size / 2, size, size)
    ctx.globalAlpha = 1
  }

  /** Rebuild the layer = base pixels + this stroke's buffer at stroke opacity. */
  private composite() {
    const ctx = this.ctx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.drawImage(this.base, 0, 0)
    ctx.globalAlpha = clamp01(this.s.opacity)
    ctx.globalCompositeOperation = this.erase ? 'destination-out' : 'source-over'
    ctx.drawImage(this.stroke, 0, 0)
    ctx.restore()
  }
}
