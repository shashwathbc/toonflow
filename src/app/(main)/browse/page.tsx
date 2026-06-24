import type { Metadata } from 'next'
import { SlidersHorizontal } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Browse — Webtoons & Manga',
  description: 'Browse all webtoons, manga, and novels by genre, status, and rating.',
}

export default function BrowsePage() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text">Browse</h1>
        <button
          className="btn-ghost text-sm"
          aria-label="Toggle advanced filters"
          aria-expanded="false"
          aria-controls="filter-panel"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Advanced Filters
        </button>
      </div>

      <div className="flex gap-8">
        {/* Filter sidebar */}
        <aside
          id="filter-panel"
          className="w-56 shrink-0 hidden md:block"
          aria-label="Content filters"
        >
          <div className="card p-4 space-y-6">
            <FilterGroup label="Sort By">
              <FilterChip active>Popular</FilterChip>
              <FilterChip>Latest</FilterChip>
              <FilterChip>Rating</FilterChip>
              <FilterChip>A–Z</FilterChip>
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterChip>Ongoing</FilterChip>
              <FilterChip>Completed</FilterChip>
              <FilterChip>Hiatus</FilterChip>
            </FilterGroup>

            <FilterGroup label="Genres">
              {[
                'Action','Adventure','Comedy','Drama','Fantasy',
                'Historical','Isekai','Mystery','Romance',
                'Sci-Fi','Slice of Life','Thriller','Wuxia',
              ].map((g) => (
                <FilterChip key={g}>{g}</FilterChip>
              ))}
            </FilterGroup>
          </div>
        </aside>

        {/* Content grid */}
        <main id="main-content" className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-text-secondary" aria-live="polite">
              Showing all results
            </p>
          </div>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            role="list"
            aria-label="Content results"
          >
            <p className="col-span-full text-text-muted text-sm">Loading…</p>
          </div>
        </main>
      </div>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

function FilterChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? 'bg-accent/10 text-accent border-accent/30'
          : 'bg-bg text-text-secondary border-bg-border hover:border-accent/30 hover:text-text'
      }`}
      aria-pressed={active ?? false}
    >
      {children}
    </button>
  )
}
