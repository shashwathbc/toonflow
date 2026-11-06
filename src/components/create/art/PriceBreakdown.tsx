'use client'

import { AlertTriangle, Info } from 'lucide-react'
import { formatMinor } from '@/lib/art/catalog'
import { priceBreakdown, type MarketplaceEconomics } from '@/lib/art/pricing'
import { cn } from '@/lib/utils/cn'

/**
 * The money split, shown to the creator before they publish.
 *
 * Every figure is derived from `priceBreakdown` — the same function the checkout
 * route runs — so what a creator is shown here is what they are actually paid.
 * The rates come from the server (the admin rate card), never from a constant
 * duplicated in the browser.
 */
export interface PriceBreakdownProps {
  retailMinor: number
  productionMinor: number
  economics: MarketplaceEconomics
  /** Rendered under the rows when the price is below the viability floor. */
  floorMinor?: number
  className?: string
}

export default function PriceBreakdown({
  retailMinor,
  productionMinor,
  economics,
  floorMinor,
  className,
}: PriceBreakdownProps) {
  const split = priceBreakdown(retailMinor, productionMinor, economics)

  const rows: { label: string; value: number; hint: string; tone: 'neutral' | 'earn' }[] = [
    {
      label: 'Customer pays',
      value: split.retailMinor,
      hint: 'The listed price for this size and fabric.',
      tone: 'neutral',
    },
    {
      label: 'Production & fulfilment',
      value: -split.productionMinor,
      hint: 'Printing, materials and delivery. Paid to the production partner.',
      tone: 'neutral',
    },
    {
      label: `Platform fee (${economics.platformFeePct}%)`,
      value: -split.platformFeeMinor,
      hint: 'Marketplace, hosting, payments and support.',
      tone: 'neutral',
    },
  ]

  return (
    <div className={cn('rounded-xl border border-bg-border bg-bg-elevated p-4', className)}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Where the money goes</h3>

      <dl className="mt-3 space-y-2" role="list">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-text-secondary">
              {row.label}
              <span className="sr-only"> — {row.hint}</span>
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-text">
              {row.value < 0 ? `− ${formatMinor(Math.abs(row.value))}` : formatMinor(row.value)}
            </dd>
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-3 border-t border-bg-border pt-2.5">
          <dt className="text-sm font-bold text-text">You earn</dt>
          <dd
            className={cn(
              'text-lg font-black tabular-nums',
              split.viable ? 'text-studio-art' : 'text-danger',
            )}
          >
            {formatMinor(split.creatorEarningsMinor)}
            <span className="ml-1.5 text-xs font-semibold text-text-muted">
              ({split.creatorMarginPct}%)
            </span>
          </dd>
        </div>
      </dl>

      {!split.viable && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 p-2.5 text-[11px] leading-relaxed text-danger"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This price doesn&apos;t cover production plus the platform fee.
            {typeof floorMinor === 'number' && ` The minimum is ${formatMinor(floorMinor)}.`} Publishing
            will be refused until you raise it.
          </span>
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-text-muted">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Payment processing (about {economics.paymentGatewayFeePct}% of the sale) comes out of the
          platform&apos;s share, not yours. Earnings move from pending to withdrawable{' '}
          {economics.earningsHoldDays === 0
            ? 'as soon as the order is delivered'
            : `${economics.earningsHoldDays} days after delivery`}
          , once the {economics.returnWindowDays}-day return window has closed.
        </span>
      </p>
    </div>
  )
}
