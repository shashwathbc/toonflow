// "How Toonflow Makes Money" — transparency infographic, rendered on the server.
import {
  Crown, Sparkles, UserPlus, Store, Megaphone, Cpu,
  Handshake, BookOpen, Shirt, Clapperboard, PieChart, Check,
} from 'lucide-react'

const SOURCES: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>
  title: string
  description: string
}[] = [
  { icon: Crown, title: 'Premium Subscription', description: 'Readers subscribe for an ad-free library and early access.' },
  { icon: Sparkles, title: 'AI Credits', description: 'Creators buy coins that power AI panel and story generation.' },
  { icon: UserPlus, title: 'Creator Subscription', description: 'Pro tools, deeper analytics, and priority AI for serious creators.' },
  { icon: Store, title: 'Marketplace', description: 'A commission on assets, artwork, and services traded between creators.' },
  { icon: Megaphone, title: 'Ads', description: 'Tasteful ads for free readers — the majority share goes to creators.' },
  { icon: Cpu, title: 'Enterprise AI APIs', description: 'Studios license our webtoon-tuned generation pipeline.' },
  { icon: Handshake, title: 'Brand Sponsorships', description: 'Brands sponsor stories, events, and creator programs.' },
  { icon: BookOpen, title: 'Publishing Partnerships', description: 'Print and digital publishing deals for breakout titles.' },
  { icon: Shirt, title: 'Merchandise', description: 'Official merch for the platform and its biggest series.' },
  { icon: Clapperboard, title: 'Animation Licensing', description: 'Licensing top stories to animation studios worldwide.' },
  { icon: PieChart, title: 'Revenue Share', description: 'The platform keeps a minority share of story revenue — creators keep the rest.' },
]

export default function HowToonflowMakesMoney() {
  return (
    <section aria-labelledby="platform-revenue-heading" className="space-y-6">
      <div>
        <h2 id="platform-revenue-heading" className="text-2xl font-bold text-text">How Toonflow makes money</h2>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          A sustainable platform means creators get paid for years, not months. These are the revenue
          sources that keep Toonflow running — no selling your data, no hidden cuts.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" role="list">
        {SOURCES.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3 bg-bg-card border border-bg-border rounded-2xl p-4 hover:border-text-muted/40 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-secondary flex-shrink-0">
              <Icon size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-semibold text-text">
                <Check size={11} className="text-success flex-shrink-0" aria-hidden="true" /> {title}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed mt-0.5">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
