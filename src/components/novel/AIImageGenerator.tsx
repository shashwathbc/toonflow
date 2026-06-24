'use client'

import { useState, useCallback } from 'react'
import { Wand2, Sparkles, X, Check, Loader2, Copy, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

const STYLES = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'fantasy art', label: 'Fantasy Art' },
  { value: 'anime style', label: 'Anime' },
  { value: 'dark fantasy', label: 'Dark Fantasy' },
  { value: 'photorealistic', label: 'Realistic' },
  { value: 'watercolor illustration', label: 'Watercolor' },
]

interface AIImageGeneratorProps {
  novelTitle: string
  novelSynopsis: string
  imageType: 'cover' | 'banner'
  onAccept: (file: File) => void
  onClose: () => void
}

export function AIImageGenerator({
  novelTitle,
  novelSynopsis,
  imageType,
  onAccept,
  onClose,
}: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('cinematic')
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)

  const autoFillPrompt = useCallback(async () => {
    setLoadingPrompt(true)
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prompt',
          novelTitle,
          novelSynopsis,
          imageType,
        }),
      })
      const data = await res.json() as { prompt?: string; error?: string }
      if (!res.ok) throw new Error(data.error)
      if (data.prompt) setPrompt(data.prompt)
    } catch {
      toast.error('Could not generate prompt — check ANTHROPIC_API_KEY')
    } finally {
      setLoadingPrompt(false)
    }
  }, [novelTitle, novelSynopsis, imageType])

  async function generateImage() {
    const fullPrompt = `${prompt.trim()}, ${style}`
    if (!prompt.trim()) {
      toast.error('Enter or auto-fill a prompt first')
      return
    }
    setLoadingImage(true)
    setImageBase64(null)
    setNoKey(false)
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: fullPrompt, imageType }),
      })
      const data = await res.json() as { imageBase64?: string; error?: string; noKey?: boolean }
      if (!res.ok) {
        if (data.noKey) setNoKey(true)
        throw new Error(data.error)
      }
      if (data.imageBase64) setImageBase64(data.imageBase64)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      if (!noKey) toast.error(msg)
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
    const file = new File([ab], `ai-${imageType}-${Date.now()}.webp`, { type: 'image/webp' })
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI generator"
          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
        >
          <X size={13} />
        </button>
      </div>

      {/* Prompt area */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] text-white/40 font-medium">Image Prompt</label>
          <button
            type="button"
            onClick={autoFillPrompt}
            disabled={loadingPrompt}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded"
          >
            {loadingPrompt ? (
              <Loader2 size={9} className="animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 size={9} aria-hidden="true" />
            )}
            Auto-fill from novel
          </button>
        </div>
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
              aria-pressed={style === s.value ? 'true' : 'false'}
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

      {/* No-key notice */}
      {noKey && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-2">
          <p className="text-[11px] text-warning font-medium">STABILITY_API_KEY not configured</p>
          <p className="text-[10px] text-white/50">
            Add <code className="bg-white/10 px-1 rounded">STABILITY_API_KEY=your_key</code> to{' '}
            <code className="bg-white/10 px-1 rounded">.env.local</code> to auto-generate images.
            Get a free key at{' '}
            <span className="text-white/70">platform.stability.ai</span>
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(prompt + ', ' + style)
              toast.success('Prompt copied — paste it in Midjourney or DALL-E!')
            }}
            className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded"
          >
            <Copy size={10} aria-hidden="true" />
            Copy prompt for external tool
          </button>
        </div>
      )}

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
              src={`data:image/webp;base64,${imageBase64}`}
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
