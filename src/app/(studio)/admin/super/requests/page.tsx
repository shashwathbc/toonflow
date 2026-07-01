'use client'

import { useEffect, useState } from 'react'
import { Flag, CheckCircle, XCircle, Trash2, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getAdminReports, updateReportStatus, createAuditLog, type AdminReport } from '@/lib/firebase/admin'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
] as const

const STATUS_COLORS: Record<AdminReport['status'], string> = {
  pending: 'bg-warning/10 text-warning',
  resolved: 'bg-accent/10 text-accent',
  dismissed: 'bg-bg-elevated text-text-muted',
}

const TYPE_COLORS: Record<string, string> = {
  novel: 'bg-blue-500/10 text-blue-400',
  webtoon: 'bg-purple-500/10 text-purple-400',
  comment: 'bg-orange-500/10 text-orange-400',
  user: 'bg-danger/10 text-danger',
}

export default function AdminRequestsPage() {
  const { firebaseUser } = useAuth()
  const [reports, setReports] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<AdminReport['status'] | undefined>(undefined)
  const [confirm, setConfirm] = useState<{ action: AdminReport['status'] | 'delete'; report: AdminReport } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAdminReports(tab)
      .then(setReports)
      .catch((e: unknown) => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [tab])

  const handleAction = async () => {
    if (!confirm || !firebaseUser) return
    setActionLoading(true)
    try {
      const { action, report } = confirm
      if (action !== 'delete') {
        await updateReportStatus(report.id, action)
        await createAuditLog({
          adminUid: firebaseUser.uid,
          adminEmail: firebaseUser.email!,
          action: `${action}_report`,
          resource: 'reports',
          resourceId: report.id,
          details: `Report on ${report.targetType} ${report.targetId} marked as ${action}`,
        })
        toast.success(`Report marked as ${action}`)
        setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: action } : r))
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const pending = reports.filter((r) => r.status === 'pending').length

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Flag size={18} aria-hidden="true" /> Reports &amp; Requests
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {pending > 0 ? (
              <span className="text-warning">{pending} pending action{pending !== 1 ? 's' : ''}</span>
            ) : (
              'All clear — no pending items'
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl w-fit" role="tablist" aria-label="Report status filter">
        {TABS.map(({ label, value }) => (
          <button
            key={label}
            role="tab"
            aria-selected={tab === value ? 'true' : 'false'}
            onClick={() => setTab(value as AdminReport['status'] | undefined)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              tab === value ? 'bg-bg-card text-text shadow-sm' : 'text-text-secondary hover:text-text'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <Flag size={24} />
            <p className="text-sm">No reports found</p>
          </div>
        ) : (
          <div className="divide-y divide-bg-border/50">
            {reports.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-bg-elevated/30 transition-colors">
                <AlertCircle size={16} className={cn('mt-0.5 flex-shrink-0', r.status === 'pending' ? 'text-warning' : 'text-text-muted')} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[r.targetType] ?? 'bg-bg-elevated text-text-muted')}>
                      {r.targetType}
                    </span>
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[r.status])}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text">{r.reason}</p>
                  {r.details && <p className="text-xs text-text-secondary mt-0.5">{r.details}</p>}
                  <p className="text-[11px] text-text-muted mt-1">
                    Target: <code className="bg-bg-elevated px-1 rounded">{r.targetId}</code>
                    {r.createdAt ? <span className="ml-2">{formatDate(r.createdAt)}</span> : null}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirm({ action: 'resolved', report: r })}
                      className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      aria-label="Mark as resolved"
                      title="Resolve"
                    >
                      <CheckCircle size={15} />
                    </button>
                    <button
                      onClick={() => setConfirm({ action: 'dismissed', report: r })}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      aria-label="Dismiss report"
                      title="Dismiss"
                    >
                      <XCircle size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.action === 'resolved' ? 'Mark as resolved?' : 'Dismiss this report?'}
        description={
          confirm?.action === 'resolved'
            ? 'This confirms the report was valid and action has been taken.'
            : 'This dismisses the report as invalid or already handled. No action will be taken.'
        }
        confirmLabel={confirm?.action === 'resolved' ? 'Mark Resolved' : 'Dismiss'}
        danger={false}
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
