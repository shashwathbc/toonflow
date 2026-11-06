'use client'

import { Info } from 'lucide-react'

/**
 * The honest state of the AI video pipeline, shown wherever a creator is about
 * to expect a clip.
 *
 * This exists because the alternative — quietly rendering a placeholder video —
 * would be indistinguishable from working software right up until someone tried
 * to publish it. Everything around generation IS built (jobs, quotas, progress,
 * cancellation, private storage, signed playback); the vendor call is the one
 * piece that needs credentials this repository does not ship.
 *
 * `connected` is resolved on the SERVER (a client can't be trusted to report
 * whether a provider exists, and the answer depends on env vars it never sees).
 */
export default function GenerationNotice({ connected }: { connected: boolean }) {
  if (connected) return null

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] p-4"
      role="status"
    >
      <Info size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-text">Video generation isn&apos;t connected yet</p>
        <p className="mt-1 leading-relaxed text-text-secondary">
          You can build projects, write scenes, plan storyboards with AI, create characters and use the
          editor right now. Pressing <strong className="font-semibold text-text">Generate</strong> will
          tell you the provider is unavailable rather than producing a placeholder clip — no video is
          ever faked.
        </p>
      </div>
    </div>
  )
}
