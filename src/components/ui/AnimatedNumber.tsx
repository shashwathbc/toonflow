'use client'

import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

export type NumberFormatter = (n: number) => string

const defaultFormat: NumberFormatter = (n) => Math.round(n).toLocaleString('en-IN')

interface AnimatedNumberProps {
  value: number
  /** Pass a module-scope function so the animation effect stays stable. */
  format?: NumberFormatter
  duration?: number
  className?: string
}

/**
 * Counts up to `value` when scrolled into view. Respects reduced-motion
 * (renders the final value immediately) and exposes the final value to
 * screen readers instead of the animation frames.
 */
export default function AnimatedNumber({ value, format, duration = 0.9, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-32px' })
  const reduceMotion = useReducedMotion()
  const fmt = format ?? defaultFormat

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduceMotion) {
      el.textContent = fmt(value)
      return
    }
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => { el.textContent = fmt(v) },
    })
    return () => controls.stop()
  }, [inView, value, duration, reduceMotion, fmt])

  return (
    <span className={className} aria-label={fmt(value)}>
      <span ref={ref} aria-hidden="true">{fmt(reduceMotion ? value : 0)}</span>
    </span>
  )
}
