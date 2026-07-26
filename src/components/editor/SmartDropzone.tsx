'use client'

import React, { useState, useEffect } from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'
import { processWebtoonImage, ProcessedImage } from '@/lib/utils/imageProcessing'
import { ImportReviewModal } from '@/components/editor/ImportReviewModal'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { useEditorStore } from '@/store/useEditorStore'

export function SmartDropzone({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const addPage = useEditorStore((state) => state.addPage)
  const addElement = useEditorStore((state) => state.addElement)
  const pages = useEditorStore((state) => state.pages)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsProcessing(true)
      const files = Array.from(e.dataTransfer.files)
      
      try {
        const results: ProcessedImage[] = []
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            const processed = await processWebtoonImage(file)
            results.push(...processed)
          }
        }
        
        setProcessedImages(results)
        if (results.length > 0) {
          setIsModalOpen(true)
        }
      } catch (err) {
        console.error('Failed to process images:', err)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleConfirmImport = async () => {
    // Current number of pages to offset X coordinate
    const startX = pages.length > 0 ? pages[pages.length - 1].x + pages[pages.length - 1].width + 100 : 0

    setIsModalOpen(false)
    setIsProcessing(true)
    try {
      for (let idx = 0; idx < processedImages.length; idx++) {
        const img = processedImages[idx]
        // Upload to Storage first so the persisted project stores a URL, not base64.
        const url = await uploadCanvasImage(img.src, img.originalName)

        // 1. Create a new page
        const pageId = crypto.randomUUID()
        addPage({
          id: pageId,
          name: img.originalName,
          width: img.width,
          height: img.height,
          x: startX + idx * (img.width + 100), // Lay them out horizontally
          y: 0,
          backgroundColor: '#FFFFFF',
        })

        // 2. Add the image element to that page
        addElement(pageId, {
          id: crypto.randomUUID(),
          type: 'image',
          src: url,
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          rotation: 0,
          opacity: 1,
          isLocked: true, // Lock imported images by default so they act as background
          isHidden: false,
          name: 'Background Image',
        })
      }
    } finally {
      setIsProcessing(false)
      setProcessedImages([])
    }
  }

  // Handle document level drag and drop as fallback
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault()
    }

    window.addEventListener('dragover', handleGlobalDragOver)
    window.addEventListener('drop', handleGlobalDrop)
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver)
      window.removeEventListener('drop', handleGlobalDrop)
    }
  }, [])

  return (
    <div 
      className="relative w-full h-full"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm border-4 border-dashed border-accent flex flex-col items-center justify-center">
          <div className="bg-[#1E1E1E] p-10 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-[#333] animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-accent/20 rounded-full text-accent">
              <UploadCloud size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white">Drop to Smart Import</h2>
            <p className="text-white/50 text-center max-w-sm">
              We&apos;ll automatically resize, slice, and pad your files to perfectly fit Webtoon standards.
            </p>
            <div className="flex gap-2 text-xs text-white/30 font-mono mt-4">
              <span>PNG</span> • <span>JPG</span> • <span>WEBP</span>
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-accent animate-spin" />
            <h2 className="text-xl font-bold text-white">Analyzing Artwork...</h2>
            <p className="text-white/50">Applying Webtoon Smart Fit logic</p>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <ImportReviewModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        images={processedImages}
        onConfirm={handleConfirmImport}
      />
    </div>
  )
}
