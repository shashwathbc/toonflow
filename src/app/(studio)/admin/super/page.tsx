import type { Metadata } from 'next'
import { Star, Settings, Database, CreditCard, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Super Admin',
}

const SUPER_SECTIONS = [
  { label: 'User Management', icon: <Users size={20} />, description: 'Full user management — promote admins, ban accounts.' },
  { label: 'System Settings', icon: <Settings size={20} />, description: 'Platform-wide settings, feature flags, maintenance mode.' },
  { label: 'Revenue Settings', icon: <CreditCard size={20} />, description: 'Coin packages, subscription plans, payout thresholds.' },
  { label: 'Database Access', icon: <Database size={20} />, description: 'View raw Firestore data, run cleanup operations.' },
]

export default function SuperAdminPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-3">
        <Star size={24} className="text-warning" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-text">Super Admin</h1>
          <p className="text-text-secondary">Full system access — proceed with caution.</p>
        </div>
      </div>

      <div className="card border-warning/30 p-4 bg-warning/5" role="alert">
        <p className="text-sm text-warning font-medium">
          ⚠ This panel is restricted to the platform owner only. All actions are logged.
        </p>
      </div>

      <section aria-labelledby="super-admin-sections-heading">
        <h2 id="super-admin-sections-heading" className="sr-only">Super admin sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUPER_SECTIONS.map(({ label, icon, description }) => (
            <div key={label} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-text-secondary" aria-hidden="true">
                  {icon}
                </div>
                <div>
                  <h3 className="font-semibold text-text">{label}</h3>
                  <p className="text-xs text-text-secondary">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
