import type { Metadata } from 'next'
import { Users, FileText, Flag, DollarSign } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Admin Panel',
}

const ADMIN_SECTIONS = [
  {
    label: 'User Management',
    icon: <Users size={20} />,
    description: 'View, manage, and update user roles.',
    stat: '—',
    statLabel: 'Total Users',
  },
  {
    label: 'Content Moderation',
    icon: <FileText size={20} />,
    description: 'Review published content and handle reports.',
    stat: '—',
    statLabel: 'Pending Reports',
  },
  {
    label: 'Reports',
    icon: <Flag size={20} />,
    description: 'Manage flagged content and user reports.',
    stat: '—',
    statLabel: 'Open',
  },
  {
    label: 'Payouts',
    icon: <DollarSign size={20} />,
    description: 'Approve and process creator withdrawal requests.',
    stat: '—',
    statLabel: 'Pending',
  },
]

export default function AdminPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Admin Panel</h1>
        <p className="text-text-secondary">Manage platform content, users, and payouts.</p>
      </div>

      <section aria-labelledby="admin-sections-heading">
        <h2 id="admin-sections-heading" className="sr-only">Admin sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ADMIN_SECTIONS.map(({ label, icon, description, stat, statLabel }) => (
            <div key={label} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-text-secondary" aria-hidden="true">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{label}</h3>
                    <p className="text-xs text-text-secondary">{description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-text" aria-label={`${statLabel}: ${stat}`}>{stat}</p>
                  <p className="text-xs text-text-muted">{statLabel}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
