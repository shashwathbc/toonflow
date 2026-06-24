import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-10 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        aria-label="Toonflow Studio Paint — go home"
      >
        <span className="text-2xl font-bold text-accent">Toonflow</span>
        <span className="text-2xl font-bold text-text"> Studio</span>
      </Link>
      <div className="w-full max-w-md">
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
