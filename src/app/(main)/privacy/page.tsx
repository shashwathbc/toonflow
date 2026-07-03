import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Toonflow Studio Paint',
  description: 'How Toonflow Studio Paint collects, uses, and protects your data.',
}

const LAST_UPDATED = 'July 3, 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-text tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-text-muted">Last updated: {LAST_UPDATED}</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Toonflow Studio Paint (&quot;Toonflow&quot;, &quot;we&quot;, &quot;us&quot;) is a platform for reading and
          creating webtoons and novels. This policy explains what we collect, why we collect it,
          and the choices you have. We keep it short and honest — we collect the minimum needed
          to run the platform well.
        </p>
      </header>

      <Section title="1. Information we collect">
        <p><strong className="text-text">Account information.</strong> When you sign up (by email or Google), we store your
        email address, display name, and optional profile photo through Firebase Authentication.</p>
        <p><strong className="text-text">Profile &amp; content.</strong> Anything you choose to add — bio, social links,
        and the novels, webtoons, chapters, comments, and ratings you create — is stored in our
        database and associated with your account.</p>
        <p><strong className="text-text">Reading activity.</strong> To count views fairly and power creator analytics, we record
        reading events (which chapter or episode was read, time spent, and scroll depth). Visitor
        identifiers, IP addresses, and browser details in these records are <strong className="text-text">one-way hashed</strong> before
        storage — we cannot recover the original values from them.</p>
        <p><strong className="text-text">Support requests.</strong> If you contact support, we keep your name, email, and message
        so we can reply and track the issue to resolution.</p>
        <p><strong className="text-text">Payments.</strong> Token purchases are processed by Razorpay. We never see or store your
        card, UPI, or banking credentials — we only receive a payment confirmation and order reference.</p>
      </Section>

      <Section title="2. How we use your information">
        <p>We use your data to: operate your account and library; show accurate view counts and pay
        creators fairly; recommend content; prevent fraud, bots, and abuse; respond to support
        requests; and send transactional emails (such as support confirmations and password resets).</p>
        <p>We do <strong className="text-text">not</strong> sell your personal data, and we do not share it with advertisers.</p>
      </Section>

      <Section title="3. Cookies">
        <p>We use a small number of first-party cookies: a session cookie to keep you signed in, a
        role cookie so protected pages load correctly, and an anonymous visitor cookie used solely
        for fair view counting. We do not use third-party advertising cookies.</p>
      </Section>

      <Section title="4. Third-party services">
        <p>Toonflow is built on Google Firebase (authentication, database, file storage). Payments are
        handled by Razorpay. AI generation features are powered by third-party AI providers that
        process the prompts you submit; prompts are not used to identify you. Each provider handles
        data under its own privacy policy.</p>
      </Section>

      <Section title="5. Data retention & deletion">
        <p>Your content stays on Toonflow as long as your account is active. You can delete individual
        works and chapters at any time from the studio. To delete your account and associated profile
        data entirely, email us at{' '}
        <a href="mailto:toonflowstudiopaint@gmail.com" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">
          toonflowstudiopaint@gmail.com
        </a>{' '}
        and we will process the request within 30 days. Hashed analytics records are retained in
        aggregate and cannot be linked back to you after account deletion.</p>
      </Section>

      <Section title="6. Security">
        <p>All traffic is encrypted in transit (HTTPS). Database access is governed by strict
        server-side security rules — for example, view counts can only be written by our servers,
        never by clients. Admin actions are audit-logged.</p>
      </Section>

      <Section title="7. Children">
        <p>Toonflow is not directed at children under 13, and we do not knowingly collect personal
        information from them. Some titles may carry maturity ratings; readers are responsible for
        respecting local age guidelines.</p>
      </Section>

      <Section title="8. Changes to this policy">
        <p>If we make material changes, we will update the date above and highlight the change on the
        platform. Continued use after a change means you accept the updated policy.</p>
      </Section>

      <Section title="9. Contact">
        <p>Questions about privacy? Email{' '}
        <a href="mailto:toonflowstudiopaint@gmail.com" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">
          toonflowstudiopaint@gmail.com
        </a>{' '}
        or use the &quot;Ask a Question&quot; link in the footer. See also our{' '}
        <Link href="/terms" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">Terms of Service</Link>{' '}
        and <Link href="/ai-policy" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">AI Policy</Link>.</p>
      </Section>
    </div>
  )
}
