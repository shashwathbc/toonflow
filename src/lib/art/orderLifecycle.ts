// The order state machine, and the rule that decides when a creator's money
// becomes theirs to withdraw.
//
// Pure functions only — no Firestore, no clock reads beyond what is passed in.
// That is what makes the payout rule testable, and a payout rule that cannot be
// tested is a payout rule nobody should trust.

/** Payment is tracked separately from fulfilment: an order can be paid and not
 *  yet produced, or produced and refunded. Collapsing them loses states. */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'

/**
 * Fulfilment stages, in order. `design_verified` sits between payment and
 * production deliberately: it is the last point at which a print file can be
 * rejected for resolution, moderation or rights reasons without a refund being
 * the only remedy.
 */
export type FulfillmentStatus =
  | 'not_started'
  | 'design_verified'
  | 'submitted'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'production_failed'
  | 'shipping_failed'
  | 'returned'

/** Where a creator's money for one order line currently sits. */
export type EarningStatus =
  | 'pending' // order placed, not yet payable
  | 'available' // hold elapsed, withdrawable
  | 'reversed' // refunded / returned / failed — never becomes payable
  | 'paid_out' // included in a completed withdrawal

/** Legal transitions. Anything not listed here is refused. */
const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  not_started: ['design_verified', 'cancelled'],
  design_verified: ['submitted', 'cancelled'],
  submitted: ['in_production', 'production_failed', 'cancelled'],
  in_production: ['shipped', 'production_failed', 'cancelled'],
  shipped: ['delivered', 'shipping_failed'],
  delivered: ['returned'],
  // Terminal.
  cancelled: [],
  production_failed: [],
  shipping_failed: [],
  returned: [],
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['paid', 'failed'],
  paid: ['refunded', 'partially_refunded'],
  partially_refunded: ['refunded'],
  failed: [],
  refunded: [],
}

export function canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return FULFILLMENT_TRANSITIONS[from]?.includes(to) ?? false
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalFulfillment(status: FulfillmentStatus): boolean {
  return FULFILLMENT_TRANSITIONS[status].length === 0
}

/** Statuses that permanently void the creator's earnings on that line. */
const REVERSING_FULFILLMENT: readonly FulfillmentStatus[] = [
  'cancelled',
  'production_failed',
  'shipping_failed',
  'returned',
]

export function reversesEarnings(payment: PaymentStatus, fulfillment: FulfillmentStatus): boolean {
  return payment === 'refunded' || payment === 'failed' || REVERSING_FULFILLMENT.includes(fulfillment)
}

export interface EarningReleaseInput {
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  /** When the item was marked delivered. null until it is. */
  deliveredAt: Date | null
  /** Days after delivery before the money is withdrawable. */
  holdDays: number
  /** Evaluation time — passed in so tests own the clock. */
  now: Date
}

/**
 * Decide where one line's earnings sit right now.
 *
 * The rule, in words: money is only ever available after the item was actually
 * DELIVERED and the return window has fully elapsed. Anything refunded,
 * cancelled, failed or returned is reversed and never becomes available — this
 * is what stops a creator withdrawing against an order that later comes back.
 */
export function earningStatusFor(input: EarningReleaseInput): EarningStatus {
  if (reversesEarnings(input.paymentStatus, input.fulfillmentStatus)) return 'reversed'
  // Unpaid money is not earnings, whatever the fulfilment state claims.
  if (input.paymentStatus !== 'paid' && input.paymentStatus !== 'partially_refunded') return 'pending'
  if (input.fulfillmentStatus !== 'delivered' || !input.deliveredAt) return 'pending'

  return input.now.getTime() >= releaseDateFor(input.deliveredAt, input.holdDays).getTime()
    ? 'available'
    : 'pending'
}

/** The moment a delivered line's earnings become withdrawable. */
export function releaseDateFor(deliveredAt: Date, holdDays: number): Date {
  return new Date(deliveredAt.getTime() + Math.max(0, holdDays) * 24 * 60 * 60 * 1000)
}

/** Human label for an order's current position in the pipeline. */
export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  not_started: 'Order placed',
  design_verified: 'Design verified',
  submitted: 'Sent to production',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  production_failed: 'Production failed',
  shipping_failed: 'Delivery failed',
  returned: 'Returned',
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

/** The happy path, in order — used to render a progress tracker. */
export const FULFILLMENT_PIPELINE: readonly FulfillmentStatus[] = [
  'not_started',
  'design_verified',
  'submitted',
  'in_production',
  'shipped',
  'delivered',
]

/** Index in the happy path, or -1 for an off-path (failed/cancelled) state. */
export function pipelineIndex(status: FulfillmentStatus): number {
  return FULFILLMENT_PIPELINE.indexOf(status)
}
