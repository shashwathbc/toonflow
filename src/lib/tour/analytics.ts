/**
 * Lightweight, non-fatal analytics for the product tour. Forwards to whatever
 * analytics sink is present on the page (Google Analytics `gtag` / a `dataLayer`)
 * and leaves a dev-console breadcrumb. No sink is required — events are best-effort.
 */

export type TourEvent =
  | 'tour_started'
  | 'tour_step_viewed'
  | 'tour_skipped'
  | 'tour_completed'
  | 'tour_time_spent'

type Gtag = (command: 'event', event: string, params?: Record<string, unknown>) => void

export function trackTour(event: TourEvent, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    const w = window as typeof window & {
      gtag?: Gtag
      dataLayer?: Array<Record<string, unknown>>
    }
    w.gtag?.('event', event, params)
    w.dataLayer?.push({ event, ...params })
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[tour]', event, params ?? {})
    }
  } catch { /* analytics must never break the tour */ }
}
