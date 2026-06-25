'use client'

import Link from 'next/link'
import { LogOut, User, LayoutDashboard, Shield, Star } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/firebase/auth'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

export default function UserMenu() {
  const { isAuthenticated, userProfile, isAdmin, isSuperAdmin } = useAuth()
  const { setLoginModalOpen } = useAppStore()

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLoginModalOpen(true)}
          className="btn-ghost text-sm py-1.5 px-3"
          aria-label="Log in to your account"
        >
          Login
        </button>
        <Link
          href="/signup"
          className="btn-accent text-sm py-1.5 px-3"
          aria-label="Create a new account"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  const initials = userProfile?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label={`Account menu for ${userProfile?.displayName ?? 'user'}`}
        >
          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center">
            <Avatar.Image
              src={userProfile?.photoURL ?? undefined}
              alt={userProfile?.displayName ?? 'User avatar'}
              className="w-full h-full object-cover"
            />
            <Avatar.Fallback
              className="text-xs font-semibold text-accent"
              delayMs={300}
            >
              {initials}
            </Avatar.Fallback>
          </Avatar.Root>
        </button>
      </DropdownMenu.Trigger>

      <UserDropdownContent side="bottom" align="end" sideOffset={8} />
    </DropdownMenu.Root>
  )
}

export function UserDropdownContent({
  side = 'bottom',
  align = 'end',
  sideOffset = 8,
}: {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) {
  const { userProfile, isAdmin, isSuperAdmin } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        className={cn(
          'z-50 min-w-48 bg-bg-card border border-bg-border rounded-xl p-1.5 shadow-xl',
          'data-[state=open]:animate-fade-in'
        )}
        side={side}
        sideOffset={sideOffset}
        align={align}
        role="menu"
        aria-label="User account menu"
      >
        {/* User info */}
        <div className="px-2 py-2 mb-1 border-b border-bg-border">
          <p className="text-sm font-semibold text-text truncate">
            {userProfile?.displayName ?? 'User'}
          </p>
          <p className="text-xs text-text-muted truncate">{userProfile?.email}</p>
        </div>

        <MenuItem href={`/profile/${userProfile?.uid}`} icon={<User size={14} />} label="Profile" />
        {userProfile?.isCreator && (
          <MenuItem href="/dashboard" icon={<LayoutDashboard size={14} />} label="Dashboard" />
        )}
        {isAdmin && (
          <MenuItem href="/admin" icon={<Shield size={14} />} label="Admin Panel" />
        )}
        {isSuperAdmin && (
          <MenuItem href="/admin/super" icon={<Star size={14} />} label="Super Admin" />
        )}

        <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />

        <DropdownMenu.Item
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-sm text-danger rounded-lg cursor-pointer',
            'hover:bg-danger/10 focus-visible:bg-danger/10 outline-none'
          )}
          onSelect={handleLogout}
          role="menuitem"
        >
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

function MenuItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary rounded-lg',
          'hover:bg-bg-elevated hover:text-text focus-visible:bg-bg-elevated focus-visible:text-text outline-none'
        )}
        role="menuitem"
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </Link>
    </DropdownMenu.Item>
  )
}
