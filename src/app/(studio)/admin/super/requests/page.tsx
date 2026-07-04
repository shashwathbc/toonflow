'use client'

import { useEffect, useState } from 'react'
import { Flag, CheckCircle, XCircle, Trash2, Loader2, AlertCircle, LifeBuoy, Mail, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  getAdminReports, updateReportStatus, createAuditLog, type AdminReport,
  getSupportRequests, updateSupportRequestStatus, deleteSupportRequest, type SupportRequest,
} from '@/lib/firebase/admin'
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
  const [tab, setTab] = useState<AdminReport['status'] | undefined>(undefined)
  // loading derives from "has the current tab been fetched" so the effect never
  // calls setState synchronously; null sentinel since tab itself can be undefined
  const [loadedTab, setLoadedTab] = useState<AdminReport['status'] | undefined | null>(null)
  const loading = loadedTab !== tab
  const [confirm, setConfirm] = useState<{ action: AdminReport['status'] | 'delete'; report: AdminReport } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [support, setSupport] = useState<SupportRequest[]>([])
  const [supportLoading, setSupportLoading] = useState(true)
  const [supportConfirm, setSupportConfirm] = useState<SupportRequest | null>(null)
  const [supportActionLoading, setSupportActionLoading] = useState(false)

  useEffect(() => {
    getSupportRequests()
      .then(setSupport)
      .catch((e: unknown) => toast.error((e as Error).message))
      .finally(() => setSupportLoading(false))
  }, [])

  const handleSupportStatus = async (r: SupportRequest, status: SupportRequest['status']) => {
    try {
      await updateSupportRequestStatus(r.id, status)
      if (firebaseUser) {
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: `support_${status}`, resource: 'supportRequests', resourceId: r.id, details: `Support request "${r.subject}" → ${status}` })
      }
      toast.success(`Marked as ${status}`)
      setSupport((prev) => prev.map((s) => s.id === r.id ? { ...s, status } : s))
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  const handleSupportDelete = async () => {
    if (!supportConfirm) return
    setSupportActionLoading(true)
    try {
      await deleteSupportRequest(supportConfirm.id)
      if (firebaseUser) {
        await createAuditLog({ adminUid: firebaseUser.uid, adminEmail: firebaseUser.email!, action: 'delete_support_request', resource: 'supportRequests', resourceId: supportConfirm.id, details: `Deleted support request "${supportConfirm.subject}"` })
      }
      toast.success('Support request deleted')
      setSupport((prev) => prev.filter((s) => s.id !== supportConfirm.id))
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSupportActionLoading(false)
      setSupportConfirm(null)
    }
  }

  useEffect(() => {
    getAdminReports(tab)
      .then(setReports)
      .catch((e: unknown) => toast.error((e as Error).message))
      .finally(() => setLoadedTab(tab))
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
    <div className="px-4 py-5 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
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

      {/* Support Inbox */}
      <section aria-labelledby="support-heading" className="space-y-3">
        <h2 id="support-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
          <LifeBuoy size={14} aria-hidden="true" /> Support Inbox
          <span className="text-text-muted normal-case font-normal tracking-normal">
            · {support.filter((s) => s.status === 'open').length} open of {support.length}
          </span>
        </h2>
        <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          {supportLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={18} className="animate-spin text-text-muted" />
            </div>
          ) : support.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-muted gap-2">
              <LifeBuoy size={20} />
              <p className="text-sm">No support requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]" role="table">
                <thead>
                  <tr className="border-b border-bg-border bg-bg-elevated/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted" scope="col">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">From</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Subject &amp; Message</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Received</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted" scope="col">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-text-muted" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {support.map((r) => (
                    <tr key={r.id} className="border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/30 transition-colors align-top">
                      <td className="px-5 py-3">
                        <span className={cn(
                          'text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                          r.type === 'issue' ? 'bg-danger/10 text-danger' : 'bg-blue-500/10 text-blue-400'
                        )}>
                          {r.type === 'issue' ? 'Issue' : 'Question'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-text">{r.name || '—'}</p>
                        <a href={`mailto:${r.email}`} className="text-xs text-text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded">
                          {r.email}
                        </a>
                        {r.emailSent && (
                          <p className="text-[10px] text-accent mt-0.5 flex items-center gap-1">
                            <Mail size={9} aria-hidden="true" /> auto-reply sent
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="text-sm font-medium text-text">{r.subject}</p>
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-3 whitespace-pre-wrap">{r.message}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {r.createdAt ? formatDate(r.createdAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                          r.status === 'open' ? 'bg-warning/10 text-warning'
                          : r.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-accent/10 text-accent'
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {r.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => handleSupportStatus(r, 'in-progress')}
                              className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                              aria-label={`Mark "${r.subject}" as in progress`}
                              title="Mark in progress"
                            >
                              <Clock size={15} />
                            </button>
                          )}
                          {r.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleSupportStatus(r, 'resolved')}
                              className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                              aria-label={`Mark "${r.subject}" as resolved`}
                              title="Mark resolved"
                            >
                              <CheckCircle size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSupportConfirm(r)}
                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                            aria-label={`Delete support request "${r.subject}"`}
                            title="Delete"
                          >
                            <Trash2 size={15} />
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
      </section>

      {/* Content Reports */}
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2 pt-2">
        <Flag size={14} aria-hidden="true" /> Content Reports
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl w-fit" role="tablist" aria-label="Report status filter">
        {TABS.map(({ label, value }) => (
          <button
            key={label}
            role="tab"
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

      <ConfirmDialog
        open={!!supportConfirm}
        title={`Delete support request "${supportConfirm?.subject}"?`}
        description="This permanently removes the request from the inbox. Make sure you've replied to the user first — this cannot be undone."
        confirmLabel="Delete Request"
        danger
        loading={supportActionLoading}
        onConfirm={handleSupportDelete}
        onCancel={() => setSupportConfirm(null)}
      />
    </div>
  )
}
