'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search, Users, ChevronDown, Loader2,
  ShieldCheck, ShieldOff, Trash2, ExternalLink, Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  getAllUsers, searchUsers, setUserRole, setUserDisabled,
  sendUserPasswordReset, deleteUserData, createAuditLog, getUserCount,
} from '@/lib/firebase/admin'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { UserProfile } from '@/types'

const ROLES = ['user', 'creator', 'admin', 'superadmin'] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-warning/10 text-warning border-warning/20',
  admin: 'bg-accent/10 text-accent border-accent/20',
  creator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  user: 'bg-bg-elevated text-text-muted border-bg-border',
}

export default function AdminUsersPage() {
  const { firebaseUser } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [confirm, setConfirm] = useState<{
    type: 'disable' | 'enable' | 'delete' | 'role'
    user: UserProfile
    newRole?: Role
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = search.trim() ? await searchUsers(search.trim()) : await getAllUsers(200)
      setUsers(data)
      getUserCount().then(setTotalCount).catch(() => setTotalCount(null))
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const id = setTimeout(load, 300)
    return () => clearTimeout(id)
  }, [load])

  const filtered = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)

  const handleConfirm = async () => {
    if (!confirm || !firebaseUser) return
    setActionLoading(true)
    try {
      const { type, user, newRole } = confirm
      if (type === 'disable') {
        await setUserDisabled(user.uid, true)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'disable_user', resource: 'users', resourceId: user.uid, details: `Disabled account: ${user.email}` })
        toast.success('Account disabled')
        setUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, disabled: true } : u))
      } else if (type === 'enable') {
        await setUserDisabled(user.uid, false)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'enable_user', resource: 'users', resourceId: user.uid, details: `Enabled account: ${user.email}` })
        toast.success('Account enabled')
        setUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, disabled: false } : u))
      } else if (type === 'delete') {
        await deleteUserData(user.uid)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'delete_user', resource: 'users', resourceId: user.uid, details: `Deleted user: ${user.email}` })
        toast.success('User deleted')
        setUsers((prev) => prev.filter((u) => u.uid !== user.uid))
      } else if (type === 'role' && newRole) {
        await setUserRole(user.uid, newRole)
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'change_role', resource: 'users', resourceId: user.uid, details: `Role: ${user.role} → ${newRole}` })
        toast.success(`Role updated to ${newRole}`)
        setUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, role: newRole } : u))
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const handleResetPassword = async (user: UserProfile) => {
    try {
      await sendUserPasswordReset(user.email)
      toast.success(`Reset email sent to ${user.email}`)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Users size={18} aria-hidden="true" /> User Management
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {totalCount !== null
              ? `${totalCount} registered user${totalCount === 1 ? '' : 's'} · showing ${filtered.length}`
              : `${filtered.length} users shown`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by name, email or UID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search users"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <Users size={24} />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" role="table">
              <thead>
                <tr className="border-b border-bg-border bg-bg-elevated/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted" scope="col">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">UID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-muted" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.uid} className="border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-bg-elevated flex-shrink-0 overflow-hidden">
                          {u.photoURL
                            ? <Image src={u.photoURL} alt="" width={32} height={32} className="object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted">{u.displayName?.[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text">{u.displayName}</p>
                          <p className="text-xs text-text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[11px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">{u.uid.slice(0, 12)}…</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <select
                          value={u.role}
                          onChange={(e) => {
                            const newRole = e.target.value as Role
                            if (newRole !== u.role) setConfirm({ type: 'role', user: u, newRole })
                          }}
                          className={cn(
                            'appearance-none text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer',
                            'bg-transparent focus:outline-none focus:ring-2 focus:ring-accent',
                            ROLE_COLORS[u.role]
                          )}
                          aria-label={`Change role for ${u.displayName}`}
                          disabled={u.role === 'superadmin' && u.email === u.email}
                        >
                          {ROLES.map((r) => <option key={r} value={r} className="bg-bg-elevated text-text">{r}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                      {u.createdAt ? formatDate(u.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full font-medium',
                        (u as UserProfile & { disabled?: boolean }).disabled
                          ? 'bg-danger/10 text-danger'
                          : 'bg-accent/10 text-accent'
                      )}>
                        {(u as UserProfile & { disabled?: boolean }).disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/profile/${u.uid}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                          aria-label={`View profile of ${u.displayName}`}
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                          aria-label={`Send password reset to ${u.email}`}
                          title="Reset password"
                        >
                          <Mail size={14} />
                        </button>
                        {(u as UserProfile & { disabled?: boolean }).disabled ? (
                          <button
                            onClick={() => setConfirm({ type: 'enable', user: u })}
                            className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                            aria-label={`Enable account of ${u.displayName}`}
                            title="Enable account"
                          >
                            <ShieldCheck size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirm({ type: 'disable', user: u })}
                            className="p-1.5 rounded-lg text-warning hover:bg-warning/10 transition-colors focus-visible:ring-2 focus-visible:ring-warning focus-visible:outline-none"
                            aria-label={`Disable account of ${u.displayName}`}
                            title="Disable account"
                            disabled={u.role === 'superadmin'}
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirm({ type: 'delete', user: u })}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                          aria-label={`Delete user ${u.displayName}`}
                          title="Delete user"
                          disabled={u.role === 'superadmin'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'delete' ? `Delete ${confirm.user.displayName}?` :
          confirm?.type === 'disable' ? `Disable ${confirm?.user.displayName}?` :
          confirm?.type === 'enable' ? `Enable ${confirm?.user.displayName}?` :
          `Change role to ${confirm?.newRole}?`
        }
        description={
          confirm?.type === 'delete'
            ? 'This permanently removes the user\'s profile data. Their content will remain but be orphaned. This cannot be undone.'
            : confirm?.type === 'disable'
            ? 'The user will be blocked from creating content and accessing protected features.'
            : confirm?.type === 'enable'
            ? 'The user\'s account will be restored to active status.'
            : `${confirm?.user.displayName}'s role will be changed from ${confirm?.user.role} to ${confirm?.newRole}.`
        }
        confirmLabel={
          confirm?.type === 'delete' ? 'Delete User' :
          confirm?.type === 'disable' ? 'Disable Account' :
          confirm?.type === 'enable' ? 'Enable Account' :
          'Change Role'
        }
        danger={confirm?.type === 'delete' || confirm?.type === 'disable'}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
