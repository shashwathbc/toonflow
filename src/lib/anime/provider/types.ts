// The AI video provider contract — the ONLY place the rest of the app is
// allowed to know about video generation vendors.
//
// SERVER ONLY. Nothing in this directory may be imported from a client
// component: implementations hold vendor API keys, and a key that reaches the
// bundle is a leaked key.
import type { GenerationSettings } from '@/types/anime'

/** Machine-readable failure causes, surfaced to the UI as job.error.code. */
export type ProviderErrorCode =
  /** No provider is configured — the integration boundary is open. */
  | 'provider_not_configured'
  /** Vendor rejected the prompt (policy / unparseable). */
  | 'bad_prompt'
  /** Vendor is rate-limiting us. */
  | 'rate_limited'
  /** Vendor account is out of credit. */
  | 'no_credits'
  /** Vendor took too long. */
  | 'timeout'
  /** Vendor returned something we can't use (truncated / wrong type). */
  | 'corrupted_output'
  /** Vendor is down or returned an unexpected status. */
  | 'provider_unavailable'
  /** The job was cancelled by the owner. */
  | 'cancelled'

export interface ProviderError {
  code: ProviderErrorCode
  /** User-facing text. Must never contain vendor keys or internal URLs. */
  message: string
  /** For rate_limited — how long to back off. */
  retryAfterMs?: number
  /** Whether a retry could plausibly succeed. Drives the UI's Retry affordance. */
  retryable: boolean
}

export interface SubmitRequest {
  /** Our job id — passed through so vendor webhooks can be correlated. */
  jobId: string
  /** Fully-composed prompt (style + characters + scene), ready for the vendor. */
  prompt: string
  negativePrompt: string
  settings: GenerationSettings
  width: number
  height: number
  /**
   * Reference image URLs for character consistency, if the vendor supports
   * image conditioning. Providers that don't must ignore these, not fail.
   */
  referenceImageUrls: string[]
}

export type SubmitResult =
  | { ok: true; providerJobId: string; /** Some vendors return progress immediately. */ progress?: number }
  | { ok: false; error: ProviderError }

export type PollResult =
  | { ok: true; status: 'processing'; progress: number }
  | {
      ok: true
      status: 'completed'
      /** Raw video bytes, or a URL we must fetch. Exactly one is set. */
      video: { kind: 'bytes'; data: Uint8Array; contentType: string } | { kind: 'url'; url: string }
      /** Real clip length reported by the vendor, seconds. */
      durationSec: number
      metadata?: Record<string, string | number | boolean>
    }
  | { ok: false; error: ProviderError }

export interface VideoProvider {
  /** Stable id recorded on every job (`GenerationJob.provider`). */
  readonly id: string
  /** Human label for operator-facing surfaces. */
  readonly label: string
  /**
   * Whether this provider has everything it needs to run (credentials, base
   * URL…). A provider that returns false is never selected, and the API answers
   * with a clear "not connected" error instead of inventing a job.
   */
  isConfigured(): boolean
  submit(req: SubmitRequest): Promise<SubmitResult>
  /** Ask the vendor where a job is. Called by the status endpoint. */
  poll(providerJobId: string): Promise<PollResult>
  /** Best-effort cancellation. Returning false just means the vendor won't. */
  cancel(providerJobId: string): Promise<boolean>
}

/** Convenience constructor so implementations report errors consistently. */
export function providerError(
  code: ProviderErrorCode,
  message: string,
  extra?: { retryAfterMs?: number; retryable?: boolean },
): ProviderError {
  return {
    code,
    message,
    retryAfterMs: extra?.retryAfterMs,
    retryable: extra?.retryable ?? (code === 'rate_limited' || code === 'timeout' || code === 'provider_unavailable'),
  }
}
