import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL, LEGAL_LAST_UPDATED } from '@/lib/utils/constants'

export const metadata: Metadata = {
  // Brand omitted on purpose — the root template appends it.
  title: 'AI Policy',
  description: 'How AI-assisted creation works on Toonflow Studio Paint, and the rules around it.',
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

export default function AIPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-text tracking-tight">AI Policy</h1>
        <p className="text-sm text-text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Toonflow believes AI should amplify creators, not replace them. Our studio tools include
          AI-assisted writing, synopsis generation, cover art, and webtoon panel generation. This
          policy explains how those tools work and the rules for using them.
        </p>
      </header>

      <Section title="1. What our AI tools do">
        <p>Creators can use tokens to run AI features inside the studio: story assistance and
        rewriting suggestions in the novel editor, synopsis drafting, and image generation for
        covers, banners, and webtoon panels in a range of art styles. Prompts you write are sent to
        third-party AI providers to generate the result, then the output is returned to your
        project.</p>
      </Section>

      <Section title="2. Ownership of AI-assisted work">
        <p>Work you create on Toonflow with AI assistance is treated like any other content you
        publish: it belongs to you, subject to the license you grant us to host and display it (see
        the <Link href="/terms" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">Terms of Service</Link>).
        Be aware that purely AI-generated material may have limited copyright protection in some
        jurisdictions — the more of your own authorship you add, the stronger your rights.</p>
      </Section>

      <Section title="3. Acceptable use">
        <p>AI tools on Toonflow may not be used to generate content that violates our content rules —
        including sexual content involving minors, targeted harassment, hate material, or deceptive
        deepfakes of real people. Do not use prompts designed to imitate a specific living artist&apos;s
        style in a way that misrepresents the output as their work.</p>
      </Section>

      <Section title="4. Transparency to readers">
        <p>We encourage creators to be upfront when substantial parts of a work are AI-generated.
        Passing off fully AI-generated series as hand-made, at scale, degrades trust for every
        creator on the platform; we may label or limit accounts that do this deceptively.</p>
      </Section>

      <Section title="5. Human review & fairness">
        <p>AI-generated content is subject to the same moderation and reporting flow as everything
        else on Toonflow. Creator earnings apply equally to AI-assisted works that follow this
        policy. Abuse of AI tools (spam series, mass low-effort uploads to farm views) may result in
        removal and loss of related earnings.</p>
      </Section>

      <Section title="6. Your prompts & data">
        <p>Prompts are processed by our AI providers to generate your result and improve platform
        reliability. We do not use your unpublished manuscripts to train AI models. See the{' '}
        <Link href="/privacy" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">Privacy Policy</Link>{' '}
        for how data flows through third-party services.</p>
      </Section>

      <Section title="7. Questions">
        <p>If you are unsure whether a use of AI is allowed, ask first:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">
          {SUPPORT_EMAIL}
        </a>.</p>
      </Section>
    </div>
  )
}
