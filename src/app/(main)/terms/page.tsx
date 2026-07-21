import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_ENTITY_NAME, LEGAL_ADDRESS, LEGAL_JURISDICTION } from '@/lib/utils/constants'

export const metadata: Metadata = {
  // Brand omitted on purpose — the root template appends it.
  title: 'Terms of Service',
  description: 'The rules for using Toonflow Studio Paint as a reader or creator.',
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-text tracking-tight">Terms of Service</h1>
        <p className="text-sm text-text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          These terms govern your use of Toonflow Studio Paint. By creating an account or using the
          platform, you agree to them. If you do not agree, please do not use Toonflow.
        </p>
      </header>

      <Section title="1. Your account">
        <p>You must provide accurate information and keep your credentials secure — you are
        responsible for activity on your account. You must be at least 13 years old (or the minimum
        digital-consent age in your country) to create an account. We may suspend or disable accounts
        that violate these terms.</p>
      </Section>

      <Section title="2. Your content & ownership">
        <p><strong className="text-text">You own what you create.</strong> Novels, webtoons, art, and text you publish on
        Toonflow remain yours. By publishing, you grant Toonflow a non-exclusive, worldwide license
        to host, display, and distribute your work on the platform so readers can access it. You can
        unpublish or delete your work at any time, which ends that license except for cached copies
        that clear in the normal course of operation.</p>
        <p>You may only upload content you have the rights to. Uploading someone else&apos;s work
        without permission — including scanlations, ripped panels, or traced art presented as
        original — is prohibited and will be removed.</p>
      </Section>

      <Section title="3. Content rules">
        <p>Do not publish content that is illegal, sexually explicit involving minors, hateful,
        harassing, or that doxxes or impersonates others. Mature themes must carry appropriate
        ratings. We may remove content or restrict accounts that break these rules, and we respond
        to valid takedown requests — report violations via &quot;Report an Issue&quot; in the footer.</p>
      </Section>

      <Section title="4. Tokens, purchases & creator earnings">
        <p>Tokens are a platform currency used for premium features such as AI generation. Token
        purchases are processed by Razorpay and are non-refundable except where required by law.
        Tokens have no cash value outside the platform and cannot be transferred between accounts.</p>
        <p>Creators earn a revenue share on qualifying validated views, as displayed in the creator
        dashboard. We validate views with anti-fraud measures; artificially inflating views (bots,
        view exchanges, self-refresh loops) forfeits the related earnings and may result in account
        termination. Withdrawals require reaching the minimum payout threshold shown in your wallet.</p>
      </Section>

      <Section title="5. AI features">
        <p>Toonflow offers AI-assisted writing and image generation. Your use of these tools is also
        governed by our <Link href="/ai-policy" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">AI Policy</Link>,
        which covers disclosure, ownership, and acceptable use of AI-generated content.</p>
      </Section>

      <Section title="6. Third-party content">
        <p>Toonflow does not host, store, or proxy third-party manga or comics. Any external titles
        that appear are metadata-only previews linking to their official sources. Toonflow Originals
        are owned by their respective creators.</p>
      </Section>

      <Section title="7. Termination">
        <p>You may stop using Toonflow at any time and request account deletion. We may suspend or
        terminate accounts that violate these terms, abuse other users, or attempt to compromise the
        platform. Where practical, we will warn you first.</p>
      </Section>

      <Section title="8. Disclaimers & liability">
        <p>Toonflow is provided &quot;as is&quot;. We work hard to keep the platform available and your
        content safe, but we cannot guarantee uninterrupted service and are not liable for indirect
        or consequential damages to the maximum extent permitted by law. Nothing in these terms
        limits rights you have under mandatory consumer-protection law.</p>
      </Section>

      <Section title="9. Governing law & jurisdiction">
        {/* TODO(legal): this clause was previously absent entirely. The platform
            bills in INR and collects GST through Razorpay, so the governing law
            and venue need to be stated explicitly. Fill in the placeholders in
            src/lib/utils/constants.ts before public launch. */}
        <p>These terms are governed by the laws of India, without regard to conflict-of-law
        principles. Any dispute arising out of or relating to these terms or your use of Toonflow
        will be subject to the exclusive jurisdiction of the courts at{' '}
        <strong className="text-text">{LEGAL_JURISDICTION}</strong>.</p>
        <p>Prices are shown in Indian Rupees (INR) and are inclusive of applicable Goods and
        Services Tax (GST) where required.</p>
      </Section>

      <Section title="10. Changes">
        <p>We may update these terms as the platform evolves. Material changes will be announced on
        the platform and the date above updated. Continued use after a change means you accept the
        updated terms.</p>
      </Section>

      <Section title="11. Contact">
        <p>Toonflow Studio Paint is operated by{' '}
        <strong className="text-text">{LEGAL_ENTITY_NAME}</strong>, registered at{' '}
        <strong className="text-text">{LEGAL_ADDRESS}</strong>.</p>
        <p>Questions about these terms? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">
          {SUPPORT_EMAIL}
        </a>. See also our{' '}
        <Link href="/privacy" className="text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded">Privacy Policy</Link>.</p>
      </Section>
    </div>
  )
}
