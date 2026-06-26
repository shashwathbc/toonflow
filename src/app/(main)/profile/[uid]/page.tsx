import type { Metadata } from 'next'
import { Users, BookOpen, ImageIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Creator Profile',
}

interface ProfilePageProps {
  params: Promise<{ uid: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { uid } = await params

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Banner */}
      <div
        className="w-full h-40 bg-bg-elevated rounded-2xl mb-0"
        aria-hidden="true"
      />

      {/* Profile header */}
      <div className="relative -mt-12 px-4 mb-6">
        <div
          className="w-24 h-24 rounded-full bg-accent/20 border-4 border-bg flex items-center justify-center"
          role="img"
          aria-label="User avatar"
        >
          <span className="text-2xl font-bold text-accent">?</span>
        </div>
        <div className="mt-3 space-y-1">
          <h1 className="text-xl font-bold text-text">Loading profile…</h1>
          <p className="text-sm text-text-secondary">UID: {uid}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-sm">
        {[
          { label: 'Followers', icon: <Users size={16} />, value: '—' },
          { label: 'Novels', icon: <BookOpen size={16} />, value: '—' },
          { label: 'Webtoons', icon: <ImageIcon size={16} />, value: '—' },
        ].map(({ label, icon, value }) => (
          <div key={label} className="card p-3 text-center">
            <div className="flex justify-center text-text-muted mb-1" aria-hidden="true">{icon}</div>
            <p className="text-lg font-bold text-text">{value}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div role="tablist" aria-label="Profile sections" className="flex gap-2 border-b border-bg-border mb-6">
        {['Novels', 'Webtoons', 'Bookmarks'].map((tab, i) => {
          const isSelected = i === 0
          return isSelected ? (
            <button
              key={tab}
              role="tab"
              aria-selected="true"
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border-accent text-accent"
            >
              {tab}
            </button>
          ) : (
            <button
              key={tab}
              role="tab"
              aria-selected="false"
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border-transparent text-text-secondary hover:text-text"
            >
              {tab}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label="Novels">
        <p className="text-text-muted text-sm">No content yet.</p>
      </div>
    </div>
  )
}
