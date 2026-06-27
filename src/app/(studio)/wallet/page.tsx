'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet, Coins, TrendingUp, ArrowDownLeft, ArrowUpRight, Clock, Check,
  X, AlertTriangle, Loader2, ArrowLeft, CreditCard, Banknote, Receipt,
  BadgeIndianRupee, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  getUserTransactions, getCreatorWithdrawals, createWithdrawalRequest,
} from '@/lib/firebase/firestore'
import { formatRelativeTimestamp } from '@/lib/utils/formatters'
import { COIN_PACKAGES } from '@/lib/utils/constants'
import { cn } from '@/lib/utils/cn'
import type { Transaction, Withdrawal, WithdrawalMethod } from '@/types'

const TOKEN_COSTS: Record<string, number> = {
  'AI Story Assist': 2,
  'AI Synopsis': 5,
  'AI Cover Image': 20,
  'AI Banner Image': 20,
  'AI Novel Generation': 50,
  'AI Webtoon Generation': 50,
}

function StatCard({ label, value, icon, accent = false }: {
  label: string; value: string; icon: React.ReactNode; accent?: boolean
}) {
  return (
    <div className={cn('border rounded-xl p-4', accent ? 'bg-accent/10 border-accent/20' : 'bg-bg-card border-bg-border')}>
      <div className={cn('flex items-center gap-2 mb-2 text-sm', accent ? 'text-accent' : 'text-white/50')}>
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', accent ? 'text-accent' : 'text-white')}>{value}</p>
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.coins > 0
  return (
    <div className="flex items-center justify-between py-3 border-b border-bg-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', isCredit ? 'bg-accent/10' : 'bg-white/5')}>
          {isCredit
            ? <ArrowDownLeft size={16} className="text-accent" aria-hidden="true" />
            : <ArrowUpRight size={16} className="text-white/40" aria-hidden="true" />
          }
        </div>
        <div>
          <p className="text-sm font-medium text-white">{tx.description}</p>
          <p className="text-xs text-white/40">{formatRelativeTimestamp(tx.createdAt)}</p>
        </div>
      </div>
      <span className={cn('text-sm font-bold', isCredit ? 'text-accent' : 'text-white/60')}>
        {isCredit ? '+' : ''}{tx.coins} tokens
      </span>
    </div>
  )
}

function WithdrawalRow({ w }: { w: Withdrawal }) {
  const statusColor: Record<string, string> = {
    pending: 'text-warning',
    approved: 'text-accent',
    processing: 'text-accent',
    completed: 'text-white',
    rejected: 'text-danger',
  }
  const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock size={12} />,
    approved: <Check size={12} />,
    processing: <Loader2 size={12} className="animate-spin" />,
    completed: <Check size={12} />,
    rejected: <X size={12} />,
  }
  return (
    <div className="flex items-center justify-between py-3 border-b border-bg-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
          <Banknote size={16} className="text-white/40" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Withdrawal — ₹{w.amount}</p>
          <p className="text-xs text-white/40">{w.method.replace('_', ' ')} · {formatRelativeTimestamp(w.createdAt)}</p>
        </div>
      </div>
      <span className={cn('text-xs font-semibold flex items-center gap-1 capitalize', statusColor[w.status] ?? 'text-white/50')}>
        {statusIcon[w.status]} {w.status}
      </span>
    </div>
  )
}

function BuyTokensSection({ balance }: { balance: number }) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)

  async function handleBuy(pkgId: string, priceInr: number, coins: number) {
    setSelectedPackage(pkgId)
    setBuying(true)

    // Check Razorpay is available
    if (typeof window === 'undefined' || !(window as typeof window & { Razorpay?: unknown }).Razorpay) {
      toast.error('Payment gateway not loaded — check NEXT_PUBLIC_RAZORPAY_KEY_ID')
      setBuying(false)
      setSelectedPackage(null)
      return
    }

    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgId, priceInr }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to create order')
      }
      const { orderId, amount, currency } = await res.json() as { orderId: string; amount: number; currency: string }

      const RazorpayClass = (window as typeof window & { Razorpay: new (opts: Record<string, unknown>) => { open(): void } }).Razorpay
      const rzp = new RazorpayClass({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: 'Toonflow Studio Paint',
        description: `${coins} Tokens`,
        order_id: orderId,
        theme: { color: '#00C896' },
        handler: () => {
          toast.success(`${coins} tokens added to your wallet!`)
        },
      })
      rzp.open()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed'
      toast.error(msg)
      console.error('[Wallet] buy error:', err)
    } finally {
      setBuying(false)
      setSelectedPackage(null)
    }
  }

  return (
    <section aria-labelledby="buy-tokens-heading">
      <h2 id="buy-tokens-heading" className="text-base font-semibold text-white mb-4 flex items-center gap-2">
        <Plus size={16} className="text-accent" aria-hidden="true" /> Buy Tokens
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COIN_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={cn(
              'relative bg-bg-card border rounded-xl p-4 transition-all',
              pkg.isPopular ? 'border-accent/30 bg-accent/5' : 'border-bg-border'
            )}
          >
            {pkg.isPopular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-accent rounded-full px-3 py-0.5">
                Most Popular
              </span>
            )}
            <div className="text-2xl font-bold text-white mb-1">
              {pkg.coins}<span className="text-sm text-white/40 ml-1">tokens</span>
            </div>
            {pkg.bonus > 0 && (
              <p className="text-xs text-accent mb-3">+{pkg.bonus} bonus tokens</p>
            )}
            <p className="text-lg font-semibold text-white mb-4">₹{pkg.priceInr}</p>
            <button
              type="button"
              onClick={() => handleBuy(pkg.id, pkg.priceInr, pkg.coins + pkg.bonus)}
              disabled={buying && selectedPackage === pkg.id}
              className={cn('w-full btn-accent text-sm', pkg.isPopular ? '' : 'opacity-90')}
            >
              {buying && selectedPackage === pkg.id ? (
                <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Processing…</>
              ) : (
                <><CreditCard size={13} aria-hidden="true" /> Buy Now</>
              )}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/30 mt-3">
        Secure payment via Razorpay · UPI · Credit/Debit Cards · Net Banking
      </p>
    </section>
  )
}

type WithdrawMethod = 'upi' | 'bank_transfer'

function WithdrawSection({ balance, onRequested }: { balance: number; onRequested: () => void }) {
  const { firebaseUser } = useAuth()
  const MIN_WITHDRAWAL = 200
  const [show, setShow] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<WithdrawMethod>('upi')
  const [upiId, setUpiId] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!firebaseUser) return
    const amtNum = parseInt(amount, 10)
    if (isNaN(amtNum) || amtNum < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ₹${MIN_WITHDRAWAL}`)
      return
    }
    if (amtNum > balance) {
      toast.error('Insufficient balance')
      return
    }
    if (method === 'upi' && !upiId.trim()) {
      toast.error('Enter your UPI ID')
      return
    }
    if (method === 'bank_transfer' && (!bankName.trim() || !accountNo.trim() || !ifsc.trim())) {
      toast.error('Fill all bank details')
      return
    }

    setSubmitting(true)
    try {
      const accountDetails: Record<string, string> =
        method === 'upi'
          ? { upiId }
          : { bankName, accountNo, ifsc }

      await createWithdrawalRequest(firebaseUser.uid, amtNum, method as WithdrawalMethod, accountDetails)
      toast.success('Withdrawal request submitted! We\'ll process it within 3-5 business days.')
      setShow(false)
      setAmount('')
      onRequested()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request'
      toast.error(msg)
      console.error('[Withdraw] error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="withdraw-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="withdraw-heading" className="text-base font-semibold text-white flex items-center gap-2">
          <Banknote size={16} className="text-white/60" aria-hidden="true" /> Withdraw Earnings
        </h2>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          disabled={balance < MIN_WITHDRAWAL}
          title={balance < MIN_WITHDRAWAL ? `Minimum withdrawal is ₹${MIN_WITHDRAWAL}` : undefined}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          {show ? 'Cancel' : 'Request Withdrawal'}
        </button>
      </div>

      {balance < MIN_WITHDRAWAL && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl p-3 text-sm text-warning mb-4">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>Minimum withdrawal is ₹{MIN_WITHDRAWAL}. Your current balance is ₹{balance}.</span>
        </div>
      )}

      {show && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
          <div>
            <label htmlFor="withdraw-amount" className="block text-xs font-medium text-white/60 mb-1.5">
              Amount (₹) *
            </label>
            <input
              id="withdraw-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={MIN_WITHDRAWAL}
              max={balance}
              className="input-base"
              placeholder={`Min ₹${MIN_WITHDRAWAL}`}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-white/60 mb-2">Payment Method *</p>
            <div className="flex gap-3">
              {[
                { value: 'upi', label: 'UPI' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value as WithdrawMethod)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                    method === m.value
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'text-white/50 border-bg-border hover:border-white/20 hover:text-white'
                  )}
                  aria-pressed={method === m.value}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === 'upi' ? (
            <div>
              <label htmlFor="upi-id" className="block text-xs font-medium text-white/60 mb-1.5">UPI ID *</label>
              <input
                id="upi-id"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="input-base"
                placeholder="name@upi"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { id: 'bank-name', key: 'bankName', label: 'Bank Name', val: bankName, set: setBankName, ph: 'HDFC Bank' },
                { id: 'account-no', key: 'accountNo', label: 'Account Number', val: accountNo, set: setAccountNo, ph: '1234567890' },
                { id: 'ifsc', key: 'ifsc', label: 'IFSC Code', val: ifsc, set: setIfsc, ph: 'HDFC0001234' },
              ].map(({ id, label, val, set, ph }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-xs font-medium text-white/60 mb-1.5">{label} *</label>
                  <input id={id} type="text" value={val} onChange={(e) => set(e.target.value)} className="input-base" placeholder={ph} />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-accent w-full"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Submitting…</> : <>Submit Withdrawal Request</>}
          </button>
        </div>
      )}
    </section>
  )
}

export default function WalletPage() {
  const { firebaseUser, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tokens' | 'earnings' | 'history'>('tokens')

  const loadData = useCallback(async () => {
    if (!firebaseUser) return
    try {
      const [txs, wds] = await Promise.all([
        getUserTransactions(firebaseUser.uid, 50),
        getCreatorWithdrawals(firebaseUser.uid),
      ])
      setTransactions(txs)
      setWithdrawals(wds)
    } catch (err) {
      console.error('[Wallet] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [firebaseUser])

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace('/auth/login')
      return
    }
    if (!authLoading && firebaseUser) loadData()
  }, [authLoading, firebaseUser, loadData, router])

  if (authLoading || loading) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="h-8 w-32 bg-bg-elevated rounded" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-bg-elevated rounded-xl" />)}
        </div>
        <div className="h-64 bg-bg-elevated rounded-xl" />
      </div>
    )
  }

  const balance = userProfile?.balance ?? 0
  const totalEarnings = userProfile?.totalEarnings ?? 0
  const tokenPurchases = transactions.filter((t) => t.coins > 0).reduce((s, t) => s + t.coins, 0)
  const tokenSpent = transactions.filter((t) => t.coins < 0).reduce((s, t) => s + Math.abs(t.coins), 0)
  const pendingWithdrawal = withdrawals.filter((w) => ['pending', 'approved', 'processing'].includes(w.status)).reduce((s, w) => s + w.amount, 0)

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-bg-border">
        <div className="max-w-screen-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/create" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white rounded" aria-label="Back to Creator Hub">
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Creator Hub</span>
            </Link>
            <span className="text-bg-border" aria-hidden="true">/</span>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wallet size={16} className="text-accent" aria-hidden="true" /> Wallet
            </h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-screen-lg mx-auto px-4 py-8 space-y-8" tabIndex={-1}>
        {/* Balance overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Token Balance"
            value={`${balance} tokens`}
            icon={<Coins size={16} aria-hidden="true" />}
            accent
          />
          <StatCard
            label="Total Earned"
            value={`₹${totalEarnings}`}
            icon={<TrendingUp size={16} aria-hidden="true" />}
          />
          <StatCard
            label="Pending Payout"
            value={`₹${pendingWithdrawal}`}
            icon={<Clock size={16} aria-hidden="true" />}
          />
        </div>

        {/* AI token costs reference */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Receipt size={14} className="text-white/50" aria-hidden="true" /> Token Costs for AI Features
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(TOKEN_COSTS).map(([feature, cost]) => (
              <div key={feature} className="flex items-center justify-between bg-bg-elevated rounded-lg px-3 py-2">
                <span className="text-xs text-white/60">{feature}</span>
                <span className="text-xs font-bold text-white">{cost} tokens</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Wallet sections" className="flex gap-0.5 border-b border-bg-border">
          {[
            { id: 'tokens', label: 'Buy Tokens' },
            { id: 'earnings', label: 'Withdraw' },
            { id: 'history', label: `History (${transactions.length})` },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t',
                activeTab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-white/50 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {activeTab === 'tokens' && <BuyTokensSection balance={balance} />}

          {activeTab === 'earnings' && (
            <WithdrawSection
              balance={totalEarnings - pendingWithdrawal}
              onRequested={loadData}
            />
          )}

          {activeTab === 'history' && (
            <section aria-labelledby="history-heading">
              <h2 id="history-heading" className="text-base font-semibold text-white mb-4">Transaction History</h2>
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-bg-border rounded-xl">
                  <Receipt size={36} className="text-white/20 mb-4" aria-hidden="true" />
                  <p className="text-white/50 text-sm">No transactions yet.</p>
                  <p className="text-white/30 text-xs mt-1">Buy tokens or use AI features to see history here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-bg-card border border-bg-border rounded-xl px-4 py-1">
                    {transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                  </div>

                  {withdrawals.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-white/60 pt-2">Withdrawal History</h3>
                      <div className="bg-bg-card border border-bg-border rounded-xl px-4 py-1">
                        {withdrawals.map((w) => <WithdrawalRow key={w.id} w={w} />)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
