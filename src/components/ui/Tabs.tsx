'use client'

import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  /** Prefix for `id`/`aria-controls` so panels can wire up (`${idBase}-panel-${id}`). */
  idBase: string
  className?: string
}

/**
 * Accessible, controlled tab list with roving tabindex + Left/Right/Home/End
 * keyboard navigation (WAI-ARIA tabs pattern). The consumer renders the panels
 * with `id={`${idBase}-panel-${id}`}`, `role="tabpanel"`,
 * `aria-labelledby={`${idBase}-tab-${id}`}` and `hidden={value !== id}`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  idBase,
  className,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.id === value)
    if (i < 0) return
    let next = i
    if (e.key === 'ArrowRight') next = (i + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('flex gap-0.5 border-b border-bg-border', className)}
    >
      {items.map(({ id, label, count }, idx) => {
        const selected = value === id
        return (
          <button
            key={id}
            ref={(el) => { refs.current[idx] = el }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${id}`}
            aria-controls={`${idBase}-panel-${id}`}
            {...(selected ? { 'aria-selected': 'true' } : { 'aria-selected': 'false' })}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t',
              selected ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text'
            )}
          >
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  selected ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-muted'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
