'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Search, Plus, LayoutDashboard, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import * as Avatar from '@radix-ui/react-avatar'
import { UserDropdownContent } from './UserMenu'

export default function MobileNav() {
  const pathname = usePathname()
  const { isAuthenticated, userProfile } = useAuth()

  const initials = userProfile?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??'

  const items = [
    {
      href: '/',
      label: 'Home',
      icon: <Home size={20} />,
      isActive: pathname === '/',
    },
    {
      href: '/originals',
      label: 'Originals',
      icon: <BookOpen size={20} />,
      isActive: pathname.startsWith('/originals'),
    },
    {
      href: '/browse',
      label: 'Browse',
      icon: <Search size={20} />,
      isActive: pathname.startsWith('/browse'),
    },
    {
      href: isAuthenticated ? '/create' : '/login?redirect=/create',
      label: 'Create',
      icon: <Plus size={20} />,
      isActive: pathname.startsWith('/create'),
    },
    {
      href: isAuthenticated ? '/dashboard' : '/login',
      label: isAuthenticated ? 'Dashboard' : 'Login',
      isActive: isAuthenticated
        ? pathname.startsWith('/dashboard') || pathname.startsWith('/profile')
        : false,
      customRender: isAuthenticated ? (
        <Avatar.Root className="w-6 h-6 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center border border-transparent hover:border-white transition-colors">
          <Avatar.Image
            src={userProfile?.photoURL ?? undefined}
            alt={userProfile?.displayName ?? 'User avatar'}
            className="w-full h-full object-cover"
          />
          <Avatar.Fallback className="text-[10px] font-bold text-accent">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>
      ) : (
        <User size={20} />
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg/90 backdrop-blur-lg border-t border-bg-border h-14 md:hidden flex items-center justify-around px-2 pb-safe"
      aria-label="Mobile navigation bar"
    >
      {items.map((item, idx) => {
        const content = item.customRender ?? item.icon

        // If it's the last item (profile/user menu) and the user is authenticated, render it as a DropdownMenu trigger
        if (idx === items.length - 1 && isAuthenticated) {
          return (
            <DropdownMenu.Root key={idx}>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    'flex flex-col items-center justify-center w-12 h-12 transition-all relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    item.isActive ? 'text-accent' : 'text-text-secondary hover:text-text'
                  )}
                  aria-label={item.label}
                >
                  <span aria-hidden="true" className={cn('transition-transform', item.isActive && 'scale-110')}>
                    {content}
                  </span>
                  {item.isActive && (
                    <span
                      className="w-1 h-1 rounded-full bg-accent absolute bottom-1.5 animate-fade-in"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </DropdownMenu.Trigger>
              <UserDropdownContent side="top" align="end" sideOffset={12} />
            </DropdownMenu.Root>
          )
        }

        return (
          <Link
            key={idx}
            href={item.href}
            onClick={(item as { onClick?: () => void }).onClick}
            className={cn(
              'flex flex-col items-center justify-center w-12 h-12 transition-all relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              item.isActive ? 'text-accent' : 'text-text-secondary hover:text-text'
            )}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
          >
            <span aria-hidden="true" className={cn('transition-transform', item.isActive && 'scale-110')}>
              {content}
            </span>
            {item.isActive && (
              <span
                className="w-1 h-1 rounded-full bg-accent absolute bottom-1.5 animate-fade-in"
                aria-hidden="true"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
