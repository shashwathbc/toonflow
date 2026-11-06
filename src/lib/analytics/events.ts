// Product analytics for the Create surfaces.
//
// PRIVACY CONTRACT — the payload allowlist below is the enforcement, not a
// convention. Only the keys in ALLOWED_PROPS survive `track()`; everything else
// is dropped before the event leaves the browser. That means a caller can never
// accidentally ship a prompt, a signed asset URL, an email or a price the way an
// ad-hoc `track(name, {...anything})` would.
//
// Opaque ids (projectId, artworkId…) are allowed: they're already visible in the
// URL to the person performing the action and carry no personal information.
// Free text (prompts, titles, descriptions) never is.

export type AnalyticsEvent =
  | 'create_anime_project'
  | 'generate_video_started'
  | 'generate_video_completed'
  | 'generate_video_failed'
  | 'generate_video_cancelled'
  | 'storyboard_generated'
  | 'video_exported'
  | 'artwork_created'
  | 'artwork_published'
  | 'product_created'
  | 'product_published'
  | 'product_viewed'
  | 'purchase_completed'

/**
 * The complete set of property names any event may carry. Values are coerced to
 * string | number | boolean; anything else is dropped.
 */
const ALLOWED_PROPS = [
  'projectId',
  'sceneId',
  'jobId',
  'artworkId',
  'productId',
  'orderId',
  'productType',
  'category',
  'source',
  'intent',
  'aspectRatio',
  'resolution',
  'durationSec',
  'sceneCount',
  'trackCount',
  'errorCode',
  'surface',
] as const

export type AnalyticsProps = Partial<Record<(typeof ALLOWED_PROPS)[number], string | number | boolean>>

/** Anything resembling a secret or a URL is refused outright, belt-and-braces. */
function isSafeValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (typeof value !== 'string') return false
  if (value.length > 120) return false
  return !/^(https?:|data:|blob:)/i.test(value)
}

function sanitize(props?: AnalyticsProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!props) return out
  for (const key of ALLOWED_PROPS) {
    const value = props[key]
    if (value !== undefined && isSafeValue(value)) out[key] = value
  }
  return out
}

type GtagWindow = Window & {
  gtag?: (command: 'event', name: string, params?: Record<string, unknown>) => void
  dataLayer?: unknown[]
}

/**
 * Record a product event. Deliberately a no-op when no analytics sink is
 * present — the app must never break because a tag manager is missing, and we
 * do not want a second vendor script in the CSP just to count clicks.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === 'undefined') return
  const payload = sanitize(props)
  const w = window as GtagWindow
  try {
    if (typeof w.gtag === 'function') {
      w.gtag('event', event, payload)
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...payload })
    } else if (process.env.NODE_ENV === 'development') {
      console.debug('[analytics]', event, payload)
    }
  } catch {
    // Analytics must never surface as an app error.
  }
}
