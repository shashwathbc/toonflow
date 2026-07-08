'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', danger = false, loading = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="relative bg-bg-elevated border border-bg-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <Tooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={onCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-card transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label="Close dialog"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </Tooltip>

            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
              danger ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
            )}>
              <AlertTriangle size={20} aria-hidden="true" />
            </div>

            <h2 id="confirm-title" className="text-base font-semibold text-text mb-1">{title}</h2>
            <p className="text-sm text-text-secondary mb-6">{description}</p>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={loading}
                className="btn-ghost text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50',
                  danger
                    ? 'bg-danger text-white hover:bg-danger/80 focus-visible:ring-danger'
                    : 'bg-accent text-black hover:bg-accent/80 focus-visible:ring-accent'
                )}
              >
                {loading ? 'Processing…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
