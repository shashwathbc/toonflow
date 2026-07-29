'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ProcessedImage } from '@/lib/utils/imageProcessing'
import { CheckCircle2, Scissors, Combine } from 'lucide-react'

interface ImportReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: ProcessedImage[]
  onConfirm: () => void
}

export function ImportReviewModal({ open, onOpenChange, images, onConfirm }: ImportReviewModalProps) {
  const numOriginalFiles = new Set(images.map(img => img.originalName.replace(/ \(Part \d+\)$/, ''))).size
  const slicedImages = images.filter(img => img.isSliced)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[101] grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#333] bg-[#1E1E1E] p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-xl font-semibold leading-none tracking-tight text-white">
              Smart Import Review
            </Dialog.Title>
            <Dialog.Description className="text-sm text-white/50">
              We processed {numOriginalFiles} files and generated {images.length} optimal Webtoon pages.
            </Dialog.Description>
          </div>

          {/* Action Summary */}
          <div className="flex gap-4 mb-2">
            <div className="flex-1 bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-full text-accent">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-accent">Smart Fit Applied</h4>
                <p className="text-xs text-accent/70">All images padded/scaled to 1080px width.</p>
              </div>
            </div>
            
            {slicedImages.length > 0 && (
              <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-full text-yellow-500">
                  <Scissors size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-500">Auto-Sliced</h4>
                  <p className="text-xs text-yellow-500/70">{slicedImages.length} pages generated from long strips.</p>
                </div>
              </div>
            )}
          </div>

          {/* Grid Preview */}
          <div className="h-[400px] overflow-y-auto rounded-lg border border-[#333] bg-[#0F0F0F] p-4 scrollbar-thin scrollbar-thumb-[#333]">
            <div className="grid grid-cols-4 gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative group flex flex-col gap-2">
                  <div className="relative aspect-[1080/1920] bg-black rounded overflow-hidden border border-[#333] group-hover:border-accent transition-colors">
                    {/* Local blob/object-URL preview of a just-imported panel (pre-upload).
                        next/image can't optimize blob: URLs, so a plain <img> is correct here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.originalName} className="object-cover w-full h-full" />
                    {img.isSliced && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        {img.partIndex}/{img.totalParts}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-white/50 truncate px-2">{img.originalName}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 bg-transparent text-white/70 hover:text-white rounded border border-[#333] hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button 
              onClick={onConfirm}
              className="px-4 py-2 bg-accent text-bg-base font-semibold rounded hover:brightness-110 transition-colors flex items-center gap-2"
            >
              <Combine size={18} />
              Import {images.length} Pages
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
