import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Was a hand-typed "Toonflow Studio" — the only place in the app that
          dropped "Paint", and it contradicted this link's own aria-label. */}
      <Link
        href="/"
        className="mb-10 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
        aria-label="Toonflow Studio Paint — go home"
      >
        <Logo size="lg" priority />
      </Link>
      <div className="w-full max-w-md">
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
