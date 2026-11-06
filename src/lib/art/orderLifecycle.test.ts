import { describe, expect, it } from 'vitest'
import {
  canTransitionFulfillment,
  canTransitionPayment,
  earningStatusFor,
  isTerminalFulfillment,
  pipelineIndex,
  releaseDateFor,
  reversesEarnings,
  type FulfillmentStatus,
  type PaymentStatus,
} from './orderLifecycle'

const DAY = 24 * 60 * 60 * 1000
const DELIVERED = new Date('2026-08-01T10:00:00Z')

describe('fulfilment transitions', () => {
  it('walks the happy path in order', () => {
    const path: FulfillmentStatus[] = [
      'not_started',
      'design_verified',
      'submitted',
      'in_production',
      'shipped',
      'delivered',
    ]
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionFulfillment(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true)
    }
  })

  it('refuses to skip design verification', () => {
    // The verification step is what catches a rights or resolution problem
    // before a print file reaches the vendor. Skipping it must be impossible.
    expect(canTransitionFulfillment('not_started', 'submitted')).toBe(false)
    expect(canTransitionFulfillment('not_started', 'in_production')).toBe(false)
  })

  it('refuses to run the pipeline backwards', () => {
    expect(canTransitionFulfillment('shipped', 'in_production')).toBe(false)
    expect(canTransitionFulfillment('delivered', 'shipped')).toBe(false)
  })

  it('treats failure states as terminal', () => {
    for (const status of ['cancelled', 'production_failed', 'shipping_failed', 'returned'] as const) {
      expect(isTerminalFulfillment(status)).toBe(true)
      expect(canTransitionFulfillment(status, 'delivered')).toBe(false)
    }
  })

  it('allows a delivered item to be returned but not re-shipped', () => {
    expect(canTransitionFulfillment('delivered', 'returned')).toBe(true)
    expect(canTransitionFulfillment('delivered', 'submitted')).toBe(false)
  })
})

describe('payment transitions', () => {
  it('cannot mark a failed payment paid', () => {
    expect(canTransitionPayment('failed', 'paid')).toBe(false)
  })

  it('cannot un-refund an order', () => {
    expect(canTransitionPayment('refunded', 'paid')).toBe(false)
  })

  it('allows the normal pending → paid → refunded route', () => {
    expect(canTransitionPayment('pending', 'paid')).toBe(true)
    expect(canTransitionPayment('paid', 'refunded')).toBe(true)
  })
})

describe('earningStatusFor', () => {
  const base = { holdDays: 7, deliveredAt: DELIVERED }

  it('holds earnings while the order is unpaid', () => {
    expect(
      earningStatusFor({
        ...base,
        paymentStatus: 'pending',
        fulfillmentStatus: 'not_started',
        now: new Date(DELIVERED.getTime() + 90 * DAY),
      }),
    ).toBe('pending')
  })

  it('holds earnings on a paid order that has not been delivered', () => {
    for (const status of ['submitted', 'in_production', 'shipped'] as const) {
      expect(
        earningStatusFor({
          ...base,
          paymentStatus: 'paid',
          fulfillmentStatus: status,
          deliveredAt: null,
          now: new Date(DELIVERED.getTime() + 90 * DAY),
        }),
      ).toBe('pending')
    }
  })

  it('keeps earnings pending until the hold has fully elapsed', () => {
    const args = { ...base, paymentStatus: 'paid' as PaymentStatus, fulfillmentStatus: 'delivered' as FulfillmentStatus }
    // One second before release.
    expect(earningStatusFor({ ...args, now: new Date(DELIVERED.getTime() + 7 * DAY - 1000) })).toBe('pending')
    // Exactly at release.
    expect(earningStatusFor({ ...args, now: new Date(DELIVERED.getTime() + 7 * DAY) })).toBe('available')
  })

  it('releases earnings once delivered and the window has passed', () => {
    expect(
      earningStatusFor({
        ...base,
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered',
        now: new Date(DELIVERED.getTime() + 8 * DAY),
      }),
    ).toBe('available')
  })

  it('reverses earnings on refund, return, cancellation and failure', () => {
    const now = new Date(DELIVERED.getTime() + 60 * DAY)
    expect(
      earningStatusFor({ ...base, paymentStatus: 'refunded', fulfillmentStatus: 'delivered', now }),
    ).toBe('reversed')
    expect(earningStatusFor({ ...base, paymentStatus: 'paid', fulfillmentStatus: 'returned', now })).toBe(
      'reversed',
    )
    expect(earningStatusFor({ ...base, paymentStatus: 'paid', fulfillmentStatus: 'cancelled', now })).toBe(
      'reversed',
    )
    expect(
      earningStatusFor({ ...base, paymentStatus: 'paid', fulfillmentStatus: 'production_failed', now }),
    ).toBe('reversed')
  })

  it('reverses a return even after the money had become available', () => {
    // The ordering matters: a return arriving after release must still flip the
    // line to reversed, so the balance recalculation removes it.
    const late = new Date(DELIVERED.getTime() + 30 * DAY)
    expect(earningStatusFor({ ...base, paymentStatus: 'paid', fulfillmentStatus: 'delivered', now: late })).toBe(
      'available',
    )
    expect(earningStatusFor({ ...base, paymentStatus: 'paid', fulfillmentStatus: 'returned', now: late })).toBe(
      'reversed',
    )
  })

  it('releases immediately when the hold is configured to zero days', () => {
    expect(
      earningStatusFor({
        ...base,
        holdDays: 0,
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered',
        now: DELIVERED,
      }),
    ).toBe('available')
  })
})

describe('reversesEarnings', () => {
  it('does not reverse a healthy in-flight order', () => {
    expect(reversesEarnings('paid', 'in_production')).toBe(false)
    expect(reversesEarnings('paid', 'delivered')).toBe(false)
  })
})

describe('releaseDateFor', () => {
  it('adds the hold window to the delivery date', () => {
    expect(releaseDateFor(DELIVERED, 7).getTime()).toBe(DELIVERED.getTime() + 7 * DAY)
  })

  it('treats a negative hold as zero', () => {
    expect(releaseDateFor(DELIVERED, -5).getTime()).toBe(DELIVERED.getTime())
  })
})

describe('pipelineIndex', () => {
  it('orders the happy path and excludes failure states', () => {
    expect(pipelineIndex('not_started')).toBe(0)
    expect(pipelineIndex('delivered')).toBeGreaterThan(pipelineIndex('shipped'))
    expect(pipelineIndex('production_failed')).toBe(-1)
  })
})
