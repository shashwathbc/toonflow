'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen, ImageIcon, Eye, Heart, Plus, Loader2,
  Coins, IndianRupee, ArrowDownToLine, X, CheckCircle,
  Clock, AlertCircle, TrendingUp, Wallet, CreditCard,
  Building2, Smartphone, Lock,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getNovelsByAuthor, getWebtoonsByAuthor } from '@/lib/firebase/firestore'
import {
  getUserTransactions, getUserWithdrawals,
  createWithdrawal,
  viewsToInr,
} from '@/lib/firebase/wallet'
import { REVENUE_CONFIG } from '@/lib/revenue/config'
import CreatorAnalyticsSection from '@/components/dashboard/CreatorAnalyticsSection'
import CreatorMonetization, { type MonetizationStats } from '@/components/dashboard/CreatorMonetization'
import { formatCount } from '@/lib/utils/formatters'
import { COIN_PACKAGES, FEATURE_FLAGS, canUseWebtoonStudio } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Novel, Webtoon, Transaction, Withdrawal, WithdrawalMethod } from '@/types'

// ── helpers ──────────────────────────────────────────────────

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

// Module scope so the impure `new Date()` read doesn't run during render (react-hooks/purity).
// Aggregates the creator's own income transactions (tips, ad + subscription revenue)
// into today / this-month totals and per-stream lifetime sums.
function aggregateCreatorRevenue(txs: Transaction[]) {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  let today = 0, month = 0, tips = 0, ads = 0, premium = 0
  for (const tx of txs) {
    if (tx.amount <= 0) continue
    const sec = tx.createdAt?.seconds ?? 0
    if (tx.type === 'tip') tips += tx.amount
    else if (tx.type === 'ad_revenue') ads += tx.amount
    else if (tx.type === 'subscription_revenue') premium += tx.amount
    else continue // not creator income (e.g. coin_purchase, ai_usage, unlocks, withdrawal)
    if (sec >= startMonth) month += tx.amount
    if (sec >= startToday) today += tx.amount
  }
  return { today, month, tips, ads, premium }
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-accent/10 text-accent',
  processing: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  rejected: 'bg-danger/10 text-danger',
}

const TX_TYPE_LABEL: Record<string, string> = {
  coin_purchase: 'Coins purchased',
  ai_usage: 'AI generation',
  chapter_unlock: 'Chapter unlocked',
  episode_unlock: 'Episode unlocked',
  tip: 'Tip received',
  ad_revenue: 'Ad revenue',
  subscription_revenue: 'Subscription revenue',
  withdrawal: 'Withdrawal',
}

// ── sub-components ───────────────────────────────────────────

function WalletCard({ label, value, sub, icon, color, action }: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
  action?: React.ReactNode
}) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
          {icon}
        </div>
        {action}
      </div>
      <div>
        <p className="text-2xl font-bold text-text tabular-nums">{value}</p>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-text-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// Locked action shown in place of Buy / Withdraw when the feature is unavailable.
function LockedPill({ hint, ariaLabel, onClick }: { hint: string; ariaLabel: string; onClick: () => void }) {
  return (
    <Tooltip label={hint} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
      >
        <Lock size={12} aria-hidden="true" /> Locked
      </button>
    </Tooltip>
  )
}

function CoverThumb({ coverURL, type }: { coverURL: string | null; type: 'novel' | 'webtoon' }) {
  const [failed, setFailed] = useState(false)
  if (!coverURL || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        {type === 'novel' ? <BookOpen size={12} /> : <ImageIcon size={12} />}
      </div>
    )
  }
  return (
    <Image
      src={coverURL}
      alt=""
      width={32}
      height={40}
      className="object-cover w-full h-full"
      onError={() => setFailed(true)}
    />
  )
}

function ContentRow({ item, type, earnedInr }: {
  item: Novel | Webtoon; type: 'novel' | 'webtoon'; earnedInr: number
}) {
  const href = type === 'novel' ? `/create/novel/${item.id}` : `/create/webtoon/${item.id}`
  return (
    <tr className="border-b border-bg-border/50 last:border-0 hover:bg-bg-elevated/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-10 rounded-lg bg-bg-elevated flex-shrink-0 overflow-hidden">
            <CoverThumb coverURL={item.coverURL} type={type} />
          </div>
          <div className="min-w-0">
            <Link href={href} className="text-sm font-medium text-text hover:text-accent transition-colors line-clamp-1">
              {item.title || 'Untitled'}
            </Link>
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              item.status === 'draft' ? 'bg-bg-elevated text-text-muted' :
              item.status === 'ongoing' ? 'bg-accent/10 text-accent' :
              'bg-purple-500/10 text-purple-400'
            )}>{item.status}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary text-right tabular-nums">
        <div className="flex items-center justify-end gap-1">
          <Eye size={11} aria-hidden="true" />
          {formatCount(item.viewCount ?? 0)}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-right tabular-nums">
        <span className="text-accent font-semibold">{fmtInr(earnedInr)}</span>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted text-right">
        <div className="flex items-center justify-end gap-1">
          <Heart size={11} aria-hidden="true" />
          {formatCount(item.likeCount ?? 0)}
        </div>
      </td>
    </tr>
  )
}

// ── Buy Tokens Modal ─────────────────────────────────────────

function BuyTokensModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const { firebaseUser } = useAuth()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pkg = COIN_PACKAGES.find((p) => p.id === selected) ?? null

  // Coins are credited ONLY by the verified Razorpay webhook — never client-side.
  const handleBuy = async () => {
    if (!pkg || !firebaseUser) return

    const Razorpay = typeof window !== 'undefined'
      ? (window as typeof window & { Razorpay?: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay
      : undefined
    if (!Razorpay) {
      toast.error('Payment gateway not loaded — please try again in a moment.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id, priceInr: pkg.priceInr }),
      })
      const data = await res.json() as { orderId?: string; amount?: number; currency?: string; error?: string }
      if (!res.ok || !data.orderId) throw new Error(data.error ?? 'Failed to create order')

      const rzp = new Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'Toonflow Studio Paint',
        description: `${pkg.coins + pkg.bonus} Coins`,
        order_id: data.orderId,
        theme: { color: '#00C896' },
        handler: () => {
          toast.success('Payment received — coins will appear shortly.')
          onSuccess()
          onClose()
        },
      })
      rzp.open()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-md shadow-2xl max-h-[85dvh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buy coins"
          >
            <div className="flex items-center justify-between p-5 border-b border-bg-border">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-warning" aria-hidden="true" />
                <h2 className="text-base font-bold text-text">Buy Coins</h2>
              </div>
              <Tooltip label="Close" side="bottom">
                <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none" aria-label="Close">
                  <X size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-text-muted mb-4">Coins power AI webtoon generation (1 coin ≈ 1 AI panel) and unlock premium chapters.</p>

              {COIN_PACKAGES.map((pkg) => (
                <button
                  type="button"
                  key={pkg.id}
                  onClick={() => setSelected(pkg.id)}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left',
                    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    selected === pkg.id
                      ? 'border-accent bg-accent/5'
                      : 'border-bg-border hover:border-bg-border/80 hover:bg-bg-elevated/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {selected === pkg.id
                      ? <CheckCircle size={16} className="text-accent flex-shrink-0" />
                      : <div className="w-4 h-4 rounded-full border-2 border-bg-border flex-shrink-0" />
                    }
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-text tabular-nums">{pkg.coins.toLocaleString()} coins</span>
                        {pkg.bonus > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-accent/10 text-accent rounded-full">
                            +{pkg.bonus} bonus
                          </span>
                        )}
                        {pkg.isPopular && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-warning/10 text-warning rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        Total: {(pkg.coins + pkg.bonus).toLocaleString()} coins
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-text tabular-nums">₹{pkg.priceInr}</p>
                    <p className="text-[10px] text-text-muted">${pkg.priceUsd}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-5 border-t border-bg-border">
              <button
                type="button"
                onClick={handleBuy}
                disabled={!selected || loading}
                className="w-full btn-accent py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {pkg ? `Pay ${fmtInr(pkg.priceInr)} · Get ${(pkg.coins + pkg.bonus).toLocaleString()} coins` : 'Select a package'}
              </button>
              <p className="text-center text-[10px] text-text-muted mt-2">Powered by Razorpay · Secure payment</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Withdraw Modal ───────────────────────────────────────────

const MIN_WITHDRAWAL = REVENUE_CONFIG.minWithdrawalInr

function WithdrawModal({ open, onClose, availableInr, onSuccess }: {
  open: boolean; onClose: () => void; availableInr: number; onSuccess: () => void
}) {
  const { firebaseUser } = useAuth()
  const [method, setMethod] = useState<WithdrawalMethod>('upi')
  const [amount, setAmount] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [loading, setLoading] = useState(false)

  const amountNum = parseFloat(amount) || 0
  const isValid =
    amountNum >= MIN_WITHDRAWAL &&
    amountNum <= availableInr &&
    (method === 'upi' ? upiId.trim().length > 3 : accountNo.trim().length > 5 && ifsc.trim().length === 11 && bankName.trim().length > 1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firebaseUser || !isValid) return
    setLoading(true)
    try {
      const accountDetails: Record<string, string> =
        method === 'upi'
          ? { upiId: upiId.trim() }
          : { bankName: bankName.trim(), accountNo: accountNo.trim(), ifsc: ifsc.trim() }
      await createWithdrawal(firebaseUser.uid, amountNum, method, accountDetails)
      toast.success('Withdrawal request submitted! Processed within 3-5 business days.')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-md shadow-2xl max-h-[85dvh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Withdraw earnings"
          >
            <div className="flex items-center justify-between p-5 border-b border-bg-border">
              <div className="flex items-center gap-2">
                <ArrowDownToLine size={16} className="text-accent" aria-hidden="true" />
                <h2 className="text-base font-bold text-text">Withdraw Earnings</h2>
              </div>
              <Tooltip label="Close" side="bottom">
                <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none" aria-label="Close">
                  <X size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-text-secondary">Available to withdraw</span>
                <span className="text-base font-bold text-accent tabular-nums">{fmtInr(availableInr)}</span>
              </div>

              {availableInr < MIN_WITHDRAWAL && (
                <div className="flex items-start gap-2 p-3 bg-warning/5 border border-warning/20 rounded-xl">
                  <AlertCircle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-warning">Minimum withdrawal is {fmtInr(MIN_WITHDRAWAL)}. Keep creating to earn more!</p>
                </div>
              )}

              {/* Amount */}
              <div>
                <label htmlFor="withdraw-amount" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Amount (₹)
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min={MIN_WITHDRAWAL}
                  max={availableInr}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min ₹${MIN_WITHDRAWAL}`}
                  className="w-full px-3 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {amountNum > availableInr && (
                  <p className="text-xs text-danger mt-1" role="alert">Exceeds available balance</p>
                )}
              </div>

              {/* Method selector */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'upi', label: 'UPI', icon: Smartphone },
                    { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMethod(id)}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                        method === id ? 'border-accent bg-accent/5 text-text' : 'border-bg-border text-text-secondary hover:border-bg-border/60'
                      )}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI fields */}
              {method === 'upi' && (
                <div>
                  <label htmlFor="upi-id" className="block text-xs font-medium text-text-secondary mb-1.5">
                    UPI ID
                  </label>
                  <input
                    id="upi-id"
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full px-3 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              {/* Bank fields */}
              {method === 'bank_transfer' && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="bank-name" className="block text-xs font-medium text-text-secondary mb-1.5">Bank Name</label>
                    <input id="bank-name" type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. State Bank of India" className="w-full px-3 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label htmlFor="account-no" className="block text-xs font-medium text-text-secondary mb-1.5">Account Number</label>
                    <input id="account-no" type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="Enter account number" className="w-full px-3 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label htmlFor="ifsc" className="block text-xs font-medium text-text-secondary mb-1.5">IFSC Code</label>
                    <input id="ifsc" type="text" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="SBIN0001234" maxLength={11} className="w-full px-3 py-2.5 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isValid || loading || availableInr < MIN_WITHDRAWAL}
                className="w-full btn-accent py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Request Withdrawal
              </button>
              <p className="text-center text-[10px] text-text-muted">Processed in 3–5 business days. TDS may apply.</p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function DashboardPage() {
  const { firebaseUser, userProfile, loading: authLoading } = useAuth()
  const canUseWebtoon = canUseWebtoonStudio(firebaseUser?.email)
  const [novels, setNovels] = useState<Novel[]>([])
  const [webtoons, setWebtoons] = useState<Webtoon[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [showBuy, setShowBuy] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  // loading derives from "has the current user's data been loaded" so the load
  // effect never calls setState synchronously (react-hooks/set-state-in-effect)
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  const loading = !firebaseUser || loadedUid !== firebaseUser.uid
  // plain value dep — optional chaining in the dep array breaks React Compiler memoization
  const profileBalance = userProfile?.balance ?? 0

  const load = useCallback(() => {
    if (!firebaseUser) return
    const uid = firebaseUser.uid
    Promise.all([
      getNovelsByAuthor(uid),
      getWebtoonsByAuthor(uid),
      getUserTransactions(uid),
      getUserWithdrawals(uid),
    ])
      .then(([n, w, tx, wd]) => {
        setNovels(n)
        setWebtoons(w)
        setTransactions(tx)
        setWithdrawals(wd)
        setCoinBalance(profileBalance)
      })
      .catch((e) => console.error(e))
      .finally(() => setLoadedUid(uid))
  }, [firebaseUser, profileBalance])

  useEffect(() => {
    if (!authLoading && firebaseUser) load()
  }, [authLoading, firebaseUser, load])

  const allContent = [
    ...novels.map((n) => ({ item: n as Novel | Webtoon, type: 'novel' as const })),
    ...webtoons.map((w) => ({ item: w as Novel | Webtoon, type: 'webtoon' as const })),
  ].sort((a, b) => (b.item.viewCount ?? 0) - (a.item.viewCount ?? 0))

  const totalViews = allContent.reduce((s, { item }) => s + (item.viewCount ?? 0), 0)
  const totalEarningsInr = viewsToInr(totalViews)
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((s, w) => s + w.amount, 0)
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === 'pending' || w.status === 'processing')
    .reduce((s, w) => s + w.amount, 0)
  const availableInr = Math.max(0, totalEarningsInr - totalWithdrawn - pendingWithdrawals)

  // ── Creator-monetization stats (all derived from already-loaded data) ──────
  const publishedContent = allContent.filter(({ item }) => item.status !== 'draft')
  const publishedChapters = publishedContent.reduce(
    (s, { item, type }) => s + (type === 'novel' ? (item as Novel).chapterCount ?? 0 : (item as Webtoon).episodeCount ?? 0),
    0,
  )
  const revenue = aggregateCreatorRevenue(transactions)
  const monetizationStats: MonetizationStats = {
    subscribers: userProfile?.followerCount ?? 0,
    views: totalViews,
    publishedChapters,
    profileComplete: Boolean(userProfile?.displayName && userProfile?.bio && userProfile?.photoURL),
    identityVerified: false, // no KYC field yet — honestly surfaced as "Pending"
    goodStanding: true, // no violations are tracked against this account
    todayRevenueInr: revenue.today,
    monthRevenueInr: revenue.month,
    pendingPayoutInr: pendingWithdrawals,
    lifetimeEarningsInr: totalEarningsInr,
    premiumSalesInr: revenue.premium,
    tipsInr: revenue.tips,
    adRevenueInr: revenue.ads,
    creatorSharePct: REVENUE_CONFIG.creatorSharePct,
    platformSharePct: REVENUE_CONFIG.platformSharePct,
  }

  // Withdrawals stay locked until the creator becomes eligible for earnings —
  // the concrete, data-backed monetization requirements (identity verification
  // has no KYC flow yet, so it isn't gated on here). Unlocks automatically once met.
  const earningEligible =
    monetizationStats.subscribers >= 1_000 &&
    monetizationStats.views >= 10_000 &&
    monetizationStats.publishedChapters >= 10 &&
    monetizationStats.profileComplete
  const buyEnabled = FEATURE_FLAGS.buyCoins

  const openBuy = () => {
    if (buyEnabled) setShowBuy(true)
    else toast('Coin purchases are temporarily unavailable.')
  }
  const openWithdraw = () => {
    if (earningEligible) setShowWithdraw(true)
    else toast('Withdrawals unlock once you meet the earning requirements.')
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  )

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 sm:space-y-7 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-elevated overflow-hidden flex-shrink-0 border border-bg-border">
            {userProfile?.photoURL
              ? <Image src={userProfile.photoURL} alt="" width={40} height={40} className="object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-sm font-bold text-text-muted">
                  {userProfile?.displayName?.[0]?.toUpperCase() ?? '?'}
                </span>
            }
          </div>
          <div>
            <h1 className="text-lg font-bold text-text">
              {userProfile?.displayName ?? 'Creator'}&apos;s Dashboard
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/create/novel" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-bg-elevated text-text hover:bg-bg-card border border-bg-border transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
            <Plus size={14} aria-hidden="true" /> Novel
          </Link>
          {canUseWebtoon && (
            <Link href="/create/webtoon" className="btn-accent flex items-center gap-1.5 text-sm">
              <Plus size={14} aria-hidden="true" /> Webtoon
            </Link>
          )}
        </div>
      </div>

      {/* Wallet Cards */}
      <section aria-labelledby="wallet-heading">
        <h2 id="wallet-heading" className="sr-only">Wallet overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <WalletCard
            label="Coin Balance"
            value={`${(coinBalance).toLocaleString()} coins`}
            sub="AI generation · unlock premium chapters"
            icon={<Coins size={16} />}
            color="bg-warning/10 text-warning"
            action={
              buyEnabled ? (
                <button
                  type="button"
                  onClick={openBuy}
                  className="text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                >
                  + Buy
                </button>
              ) : (
                <LockedPill hint="Coin purchases are temporarily unavailable" ariaLabel="Buy coins — temporarily locked" onClick={openBuy} />
              )
            }
          />
          <WalletCard
            label="Total Revenue"
            value={fmtInr(totalEarningsInr)}
            icon={<TrendingUp size={16} />}
            color="bg-accent/10 text-accent"
          />
          <WalletCard
            label="Available to Withdraw"
            value={fmtInr(availableInr)}
            sub={
              !earningEligible
                ? 'Unlock by meeting earning requirements'
                : pendingWithdrawals > 0 ? `₹${pendingWithdrawals.toFixed(2)} pending` : `Min ₹${MIN_WITHDRAWAL} to withdraw`
            }
            icon={<Wallet size={16} />}
            color="bg-green-500/10 text-green-400"
            action={
              earningEligible ? (
                <button
                  type="button"
                  onClick={openWithdraw}
                  className="text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                >
                  Withdraw
                </button>
              ) : (
                <LockedPill hint="Unlocks when you're eligible for earnings" ariaLabel="Withdraw — locked until eligible for earnings" onClick={openWithdraw} />
              )
            }
          />
          <WalletCard
            label="Paid Out"
            value={fmtInr(totalWithdrawn)}
            sub={pendingWithdrawals > 0
              ? `${fmtInr(pendingWithdrawals)} pending payout`
              : `${withdrawals.filter((w) => w.status === 'completed').length} completed payouts`}
            icon={<ArrowDownToLine size={16} />}
            color="bg-purple-500/10 text-purple-400"
          />
        </div>
      </section>

      {/* Creator monetization — how earning works, unlock progress, journey & transparency */}
      <CreatorMonetization stats={monetizationStats} />

      {/* Creator analytics — views, revenue, subscribers, top content */}
      <div data-tour="dashboard-analytics">
        <CreatorAnalyticsSection />
      </div>

      {/* Content Performance */}
      <section aria-labelledby="performance-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
          <h2 id="performance-heading" className="text-sm font-semibold text-text flex items-center gap-2">
            <TrendingUp size={14} aria-hidden="true" /> Content Performance
          </h2>
          <span className="text-xs text-text-muted">{allContent.length} works</span>
        </div>

        {allContent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-text-muted gap-2">
            <BookOpen size={22} />
            <p className="text-sm">No content yet</p>
            <div className="flex gap-3 mt-1">
              <Link href="/create/novel" className="text-xs text-accent hover:underline">Write a novel →</Link>
              {canUseWebtoon && <Link href="/create/webtoon" className="text-xs text-accent hover:underline">Create a webtoon →</Link>}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]" role="table">
              <thead>
                <tr className="border-b border-bg-border bg-bg-elevated/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Title</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Views</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Earned (INR)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted" scope="col">Likes</th>
                </tr>
              </thead>
              <tbody>
                {allContent.map(({ item, type }) => (
                  <ContentRow
                    key={item.id}
                    item={item}
                    type={type}
                    earnedInr={viewsToInr(item.viewCount ?? 0)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-bg-border bg-bg-elevated/30">
                  <td className="px-4 py-2.5 text-xs font-semibold text-text-secondary" colSpan={1}>Total</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-text text-right tabular-nums">{formatCount(totalViews)}</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-accent text-right tabular-nums">{fmtInr(totalEarningsInr)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Bottom row: Transactions + Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transactions */}
        <section aria-labelledby="tx-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border">
            <h2 id="tx-heading" className="text-sm font-semibold text-text flex items-center gap-2">
              <CreditCard size={14} aria-hidden="true" /> Recent Transactions
            </h2>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-muted gap-1">
              <CreditCard size={20} />
              <p className="text-xs">No transactions yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-bg-border/50">
              {transactions.slice(0, 8).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-bg-elevated/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {TX_TYPE_LABEL[tx.type] ?? tx.type}
                    </p>
                    <p className="text-xs text-text-muted truncate">{tx.description}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 ml-3">
                    {tx.coins !== 0 && (
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        tx.coins > 0 ? 'text-warning' : 'text-danger'
                      )}>
                        {tx.coins > 0 ? '+' : ''}{tx.coins} coins
                      </span>
                    )}
                    {tx.amount !== 0 && (
                      <span className={cn(
                        'text-xs tabular-nums',
                        tx.type === 'coin_purchase' ? 'text-danger' : 'text-accent'
                      )}>
                        {tx.type === 'coin_purchase' ? '-' : '+'}{fmtInr(Math.abs(tx.amount))}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Withdrawals */}
        <section aria-labelledby="wd-heading" className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
            <h2 id="wd-heading" className="text-sm font-semibold text-text flex items-center gap-2">
              <ArrowDownToLine size={14} aria-hidden="true" /> Withdrawal History
            </h2>
            {earningEligible ? (
              <button
                type="button"
                onClick={openWithdraw}
                className="text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
              >
                Request
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Lock size={12} aria-hidden="true" /> Locked
              </span>
            )}
          </div>
          {withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-muted gap-1">
              <IndianRupee size={20} />
              <p className="text-xs">No withdrawals yet</p>
              {earningEligible && availableInr >= MIN_WITHDRAWAL && (
                <button type="button" onClick={openWithdraw} className="text-xs text-accent hover:underline mt-1">
                  Withdraw now →
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-bg-border/50">
              {withdrawals.slice(0, 8).map((wd) => (
                <li key={wd.id} className="flex items-center justify-between px-5 py-3 hover:bg-bg-elevated/30 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    {wd.status === 'completed'
                      ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                      : wd.status === 'rejected'
                      ? <AlertCircle size={13} className="text-danger flex-shrink-0" />
                      : <Clock size={13} className="text-warning flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {fmtInr(wd.amount)}
                      </p>
                      <p className="text-xs text-text-muted capitalize">{wd.method.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0',
                    STATUS_BADGE[wd.status] ?? 'bg-bg-elevated text-text-muted'
                  )}>
                    {wd.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modals */}
      <BuyTokensModal
        open={showBuy}
        onClose={() => setShowBuy(false)}
        onSuccess={load}
      />
      <WithdrawModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        availableInr={availableInr}
        onSuccess={load}
      />
    </div>
  )
}
