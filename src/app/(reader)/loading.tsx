export default function ReaderLoading() {
  return (
    <div className="min-h-screen bg-black" aria-busy="true" aria-label="Loading chapter">
      <div className="sticky top-0 h-12 bg-bg-card/80 border-b border-bg-border animate-pulse" />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <div className="h-8 w-2/3 bg-bg-elevated rounded animate-pulse" />
        <div className="h-4 w-40 bg-bg-elevated rounded animate-pulse" />
        <div className="pt-6 space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-bg-card rounded animate-pulse"
              style={{ width: `${85 + ((i * 7) % 15)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
