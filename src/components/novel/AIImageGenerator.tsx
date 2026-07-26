'use client'

import { useState } from 'react'
import { Sparkles, X, Check, Loader2, RotateCcw } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import { now } from '@/lib/utils/time'

const STYLES = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'fantasy art', label: 'Fantasy Art' },
  { value: 'anime style', label: 'Anime' },
  { value: 'dark fantasy', label: 'Dark Fantasy' },
  { value: 'photorealistic', label: 'Realistic' },
  { value: 'watercolor illustration', label: 'Watercolor' },
]

interface AIImageGeneratorProps {
  imageType: 'cover' | 'banner'
  onAccept: (file: File) => void
  onClose: () => void
  userId?: string
}

export function AIImageGenerator({
  imageType,
  onAccept,
  onClose,
  userId,
}: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [loadingImage, setLoadingImage] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState('image/jpeg')

  async function generateImage() {
    const fullPrompt = `${prompt.trim()}, ${style}`
    if (!prompt.trim()) {
      toast.error('Enter or auto-fill a prompt first')
      return
    }
    setLoadingImage(true)
    setImageBase64(null)
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: fullPrompt, imageType, userId }),
      })
      const data = await res.json() as { imageBase64?: string; imageMime?: string; error?: string; insufficientTokens?: boolean }
      if (!res.ok) {
        if (data.insufficientTokens) {
          toast.error(data.error ?? 'Not enough tokens', { duration: 6000 })
          return
        }
        throw new Error(data.error)
      }
      if (data.imageBase64) {
        setImageBase64(data.imageBase64)
        setImageMime(data.imageMime ?? 'image/jpeg')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      toast.error(msg)
    } finally {
      setLoadingImage(false)
    }
  }

  function handleAccept() {
    if (!imageBase64) return
    const byteString = atob(imageBase64)
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const ext = imageMime.includes('png') ? 'png' : imageMime.includes('webp') ? 'webp' : 'jpg'
    const file = new File([ab], `ai-${imageType}-${now()}.${ext}`, { type: imageMime })
    onAccept(file)
    toast.success('AI image applied!')
  }

  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl p-4 space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-white/50" aria-hidden="true" />
          <span className="text-xs font-semibold text-white/80">
            AI Generate {imageType === 'cover' ? 'Cover' : 'Banner'}
          </span>
        </div>
        <Tooltip label="Close" side="left">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI generator"
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Prompt area */}
      <div>
        <label className="block text-[11px] text-white/40 font-medium mb-1.5">Image Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Describe the ${imageType === 'cover' ? 'cover' : 'banner'} you want…`}
          rows={3}
          aria-label="Image generation prompt"
          className="input-base resize-none text-xs w-full"
        />
      </div>

      {/* Style chips */}
      <div>
        <p className="text-[11px] text-white/40 font-medium mb-1.5">Art Style</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Art style">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStyle(s.value)}
              {...(style === s.value ? { 'aria-pressed': 'true' } : { 'aria-pressed': 'false' })}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white',
                style === s.value
                  ? 'bg-white text-bg border-white font-semibold'
                  : 'border-bg-border text-white/50 hover:border-white/40 hover:text-white'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {imageBase64 && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40">Preview</p>
          <div
            className={cn(
              'relative overflow-hidden rounded-lg bg-bg-card',
              imageType === 'cover' ? 'aspect-[2/3] max-w-[100px]' : 'aspect-[16/9]'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${imageMime};base64,${imageBase64}`}
              alt="AI generated preview"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleAccept}
            className="btn-accent text-xs w-full flex items-center justify-center gap-1.5"
          >
            <Check size={12} aria-hidden="true" />
            Use this image
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={generateImage}
          disabled={loadingImage || !prompt.trim()}
          className="btn-accent text-xs flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {loadingImage ? (
            <>
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Generating…
            </>
          ) : (
            <>
              {imageBase64 ? (
                <RotateCcw size={12} aria-hidden="true" />
              ) : (
                <Sparkles size={12} aria-hidden="true" />
              )}
              {imageBase64 ? 'Try Again' : 'Generate Image'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
