'use client'

import { X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />

        {/* Panel */}
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md bg-bg-card border border-bg-border rounded-2xl shadow-2xl',
            'data-[state=open]:animate-fade-in',
            'focus:outline-none',
            className
          )}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
            <Dialog.Title className="text-base font-semibold text-text">
              {title}
            </Dialog.Title>
            <Tooltip label="Close" side="bottom">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="btn-ghost p-1.5 rounded-lg"
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </Tooltip>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            {description && (
              <Dialog.Description id="modal-description" className="text-sm text-text-secondary mb-4">
                {description}
              </Dialog.Description>
            )}
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
