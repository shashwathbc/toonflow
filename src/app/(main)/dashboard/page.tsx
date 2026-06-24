import type { Metadata } from 'next'
import { TrendingUp, Eye, Users, DollarSign } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Creator Dashboard',
}

export default function DashboardPage() {
  const stats = [
    { label: 'Total Views', value: '0', icon: <Eye size={20} />, change: '+0%' },
    { label: 'Monthly Views', value: '0', icon: <TrendingUp size={20} />, change: '+0%' },
    { label: 'Subscribers', value: '0', icon: <Users size={20} />, change: '+0%' },
    { label: 'Earnings', value: '₹0', icon: <DollarSign size={20} />, change: '+0%' },
  ]

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Creator Dashboard</h1>
        <p className="text-text-secondary">Track your content performance and earnings.</p>
      </div>

      {/* Stats grid */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Performance statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon, change }) => (
            <div key={label} className="card p-4 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span aria-hidden="true">{icon}</span>
                <span className="text-xs text-success">{change}</span>
              </div>
              <p className="text-2xl font-bold text-text" aria-label={`${label}: ${value}`}>{value}</p>
              <p className="text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top content */}
      <section aria-labelledby="top-content-heading">
        <h2 id="top-content-heading" className="section-heading mb-4">Top Content</h2>
        <div className="card p-6">
          <p className="text-text-muted text-sm">
            Publish content to see performance analytics here.
          </p>
        </div>
      </section>

      {/* Earnings */}
      <section aria-labelledby="earnings-heading">
        <h2 id="earnings-heading" className="section-heading mb-4">Earnings</h2>
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-sm">Withdrawable Balance</p>
              <p className="text-2xl font-bold text-accent">₹0.00</p>
            </div>
            <button className="btn-accent" disabled aria-label="Withdraw earnings — minimum not yet reached">
              Withdraw
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
