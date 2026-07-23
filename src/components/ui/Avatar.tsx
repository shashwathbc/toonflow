'use client'

import * as RadixAvatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils/cn'

interface AvatarProps {
  src?: string | null
  /** Full name — used for the alt text and to derive initials for the fallback. */
  name: string
  size?: number
  className?: string
}

/** Up to two uppercase initials from a display name (e.g. "Ada Lovelace" → "AL"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Circular avatar with a lazily-loaded image and an initials fallback (shown
 * while the image loads or if it fails). Built on @radix-ui/react-avatar.
 */
export default function Avatar({ src, name, size = 40, className }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/20',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src && (
        <RadixAvatar.Image
          src={src}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <RadixAvatar.Fallback
        delayMs={src ? 300 : 0}
        className="flex h-full w-full items-center justify-center font-semibold text-accent"
        style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
      >
        {initialsOf(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}
