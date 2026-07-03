'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, CheckCircle, LifeBuoy } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

export type SupportType = 'question' | 'issue'

interface SupportModalProps {
  open: boolean
  initialType?: SupportType
  onClose: () => void
}

export function SupportModal({ open, initialType = 'question', onClose }: SupportModalProps) {
  return (
    <AnimatePresence>
      {open && <SupportDialog initialType={initialType} onClose={onClose} />}
    </AnimatePresence>
  )
}

// Mounted fresh each time the modal opens, so state initializers handle
// prefill/reset without effect-driven setState.
function SupportDialog({ initialType, onClose }: { initialType: SupportType; onClose: () => void }) {
  const { firebaseUser, userProfile } = useAuth()
  const [type, setType] = useState<SupportType>(initialType)
  const [name, setName] = useState(() => userProfile?.displayName ?? '')
  const [email, setEmail] = useState(() => firebaseUser?.email ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape to close + move focus into the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, email, subject, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
      setSubmitted(true)
      setSubject('')
      setMessage('')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
            tabIndex={-1}
            className="w-full max-w-lg bg-bg-card border border-bg-border rounded-2xl shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border sticky top-0 bg-bg-card">
              <h2 id="support-modal-title" className="text-base font-bold text-text flex items-center gap-2">
                <LifeBuoy size={16} className="text-accent" aria-hidden="true" />
                Contact Support
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-elevated transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label="Close support dialog"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
                <CheckCircle size={36} className="text-accent" aria-hidden="true" />
                <h3 className="text-lg font-bold text-text">Request received!</h3>
                <p className="text-sm text-text-secondary max-w-sm leading-relaxed" role="status">
                  Thanks for connecting with us. We&apos;ve sent a confirmation to your email
                  and our team will get back to you soon — usually within 24–48 hours.
                </p>
                <button type="button" onClick={onClose} className="btn-accent text-sm px-5 py-2 mt-2 focus-visible:ring-2 focus-visible:ring-accent">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Type selector */}
                <fieldset>
                  <legend className="text-xs font-medium text-text-secondary mb-2">What can we help with?</legend>
                  <div className="flex gap-2">
                    {([
                      ['question', 'Ask a Question'],
                      ['issue', 'Report an Issue'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={cn(
                          'text-xs px-3.5 py-2 rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                          type === value
                            ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                            : 'border-bg-border text-text-secondary hover:text-text hover:border-white/20'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="support-name" className="block text-xs font-medium text-text-secondary mb-1.5">Your name</label>
                    <input
                      id="support-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="support-email" className="block text-xs font-medium text-text-secondary mb-1.5">Email <span className="text-danger">*</span></label>
                    <input
                      id="support-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="support-subject" className="block text-xs font-medium text-text-secondary mb-1.5">Subject <span className="text-danger">*</span></label>
                  <input
                    id="support-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={150}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder={type === 'issue' ? 'Something is broken on…' : 'How do I…'}
                  />
                </div>

                <div>
                  <label htmlFor="support-message" className="block text-xs font-medium text-text-secondary mb-1.5">Message <span className="text-danger">*</span></label>
                  <textarea
                    id="support-message"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4000}
                    rows={5}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                    placeholder={type === 'issue'
                      ? 'Describe the issue: what happened, what you expected, and the page it happened on.'
                      : 'Tell us what you would like to know.'}
                  />
                </div>

                {error && (
                  <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-text-muted">
                    We&apos;ll reply from toonflowstudiopaint@gmail.com
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-accent text-sm px-5 py-2 flex items-center gap-2 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {submitting
                      ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Sending…</>
                      : 'Submit Request'}
                  </button>
                </div>
              </form>
        )}
      </motion.div>
    </motion.div>
  )
}
