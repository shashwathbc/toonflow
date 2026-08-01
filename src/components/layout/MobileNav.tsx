'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Sparkles, Star, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import { UserDropdownContent } from './UserMenu'

/** A standard labelled tab: icon in a rounded highlight with a caption below. */
function Tab({
  href,
  label,
  icon,
  isActive,
}: {
  href: string
  label: string
  icon: React.ReactNode
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-xl px-3.5 py-1 transition-colors',
          isActive
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary group-hover:text-text'
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'text-[10px] leading-none transition-colors',
          isActive ? 'font-semibold text-accent' : 'text-text-muted group-hover:text-text-secondary'
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export default function MobileNav() {
  const pathname = usePathname()
  const { isAuthenticated, userProfile } = useAuth()

  const initials = userProfile?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??'

  const accountActive =
    pathname.startsWith('/dashboard') || pathname.startsWith('/profile')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-bg-border bg-bg/90 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation bar"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-1">
        <Tab
          href="/"
          label="Home"
          icon={<Home size={20} />}
          isActive={pathname === '/'}
        />
        <Tab
          href="/browse"
          label="Browse"
          icon={<BookOpen size={20} />}
          isActive={pathname.startsWith('/browse')}
        />

        {/* Create — the raised, focal call-to-action */}
        <Link
          href={isAuthenticated ? '/create' : '/login?redirect=/create'}
          aria-label="Create new content"
          aria-current={pathname.startsWith('/create') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            aria-hidden="true"
            className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-white text-bg shadow-lg shadow-black/30 ring-4 ring-bg transition-transform active:scale-95"
          >
            <Sparkles size={22} />
          </span>
          <span className="text-[10px] font-semibold leading-none text-accent">
            Create
          </span>
        </Link>

        <Tab
          href="/originals"
          label="Originals"
          icon={<Star size={20} />}
          isActive={pathname.startsWith('/originals')}
        />

        {/* Account — avatar dropdown (Profile / Dashboard / Sign out) or Login */}
        {isAuthenticated ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex items-center justify-center rounded-xl px-3 py-1 transition-colors',
                    accountActive && 'bg-accent/15'
                  )}
                >
                  <Avatar.Root
                    className={cn(
                      'flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border bg-accent/20 transition-colors',
                      accountActive ? 'border-accent' : 'border-transparent group-hover:border-white'
                    )}
                  >
                    <Avatar.Image
                      src={userProfile?.photoURL ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <Avatar.Fallback className="text-[10px] font-bold text-accent">
                      {initials}
                    </Avatar.Fallback>
                  </Avatar.Root>
                </span>
                <span
                  className={cn(
                    'text-[10px] leading-none transition-colors',
                    accountActive ? 'font-semibold text-accent' : 'text-text-muted group-hover:text-text-secondary'
                  )}
                >
                  You
                </span>
              </button>
            </DropdownMenu.Trigger>
            <UserDropdownContent side="top" align="end" sideOffset={12} />
          </DropdownMenu.Root>
        ) : (
          <Tab
            href="/login"
            label="Login"
            icon={<User size={20} />}
            isActive={pathname.startsWith('/login')}
          />
        )}
      </div>
    </nav>
  )
}
