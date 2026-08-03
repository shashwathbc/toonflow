'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  life: number
}

const COLORS = ['#FFFFFF', '#00C896', '#FFB800', '#5B84F5', '#FF6B9D', '#A78BFA']

/**
 * Self-contained canvas confetti burst — no dependencies. Fires once on mount and
 * cleans itself up. Renders nothing (and does no work) under prefers-reduced-motion.
 */
export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let w = window.innerWidth
    let h = window.innerHeight
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Two bursts from the lower corners, arcing up and out.
    const particles: Particle[] = []
    const spawn = (originX: number) => {
      for (let i = 0; i < 90; i++) {
        const angle = (Math.random() * Math.PI) / 2 + Math.PI / 4 // upward cone
        const speed = 8 + Math.random() * 9
        particles.push({
          x: originX,
          y: h + 10,
          vx: Math.cos(angle) * speed * (originX < w / 2 ? 1 : -1),
          vy: -Math.sin(angle) * speed - 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          size: 5 + Math.random() * 6,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1,
        })
      }
    }
    spawn(w * 0.2)
    spawn(w * 0.8)

    let raf = 0
    const gravity = 0.28
    const drag = 0.99
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      let alive = 0
      for (const p of particles) {
        if (p.life <= 0) continue
        p.vy += gravity
        p.vx *= drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= 0.008
        if (p.y > h + 40) p.life = 0
        if (p.life <= 0) continue
        alive++
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (alive > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[120]"
    />
  )
}
