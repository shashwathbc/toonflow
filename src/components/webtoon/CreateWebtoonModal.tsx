'use client'

import { useState, useRef, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Image from 'next/image'
import {
  X,
  Upload,
  ImageIcon,
  Loader2,
  ChevronDown,
  Tag,
  Plus,
  Check,
  Sparkles,
  Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createWebtoon, updateWebtoon } from '@/lib/firebase/firestore'
import { uploadWebtoonCover } from '@/lib/firebase/storage'
import { GENRES } from '@/lib/utils/constants'
import type { Webtoon } from '@/types'
import { AIImageGenerator } from '@/components/novel/AIImageGenerator'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title too long'),
  synopsis: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Too long'),
  genres: z.array(z.string()).min(1, 'Select at least one genre').max(5, 'Max 5 genres'),
  tags: z.array(z.string()),
  status: z.enum(['draft', 'ongoing', 'completed', 'hiatus']),
  visibility: z.enum(['public', 'private']),
})

type FormData = z.infer<typeof schema>

interface Props {
  authorId: string
  authorName: string
  authorPhotoURL: string | null
  editWebtoon?: Webtoon | null
  onClose: () => void
  onCreated: (id: string) => void
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', desc: 'Not visible publicly' },
  { value: 'ongoing', label: 'Ongoing', desc: 'Actively updating' },
  { value: 'completed', label: 'Completed', desc: 'Story finished' },
  { value: 'hiatus', label: 'Hiatus', desc: 'Temporarily paused' },
]

function UploadBox({
  label,
  aspect,
  value,
  progress,
  onChange,
}: {
  label: string
  aspect: string
  value: string | null
  progress: number
  onChange: (file: File) => void
}) {
  const inputId = `upload-${label.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <div>
      <p className="text-xs font-medium text-white/60 mb-1.5" id={`${inputId}-label`}>
        {label}
      </p>
      <label
        htmlFor={inputId}
        className={`relative bg-bg-elevated border-2 border-dashed border-bg-border rounded-xl overflow-hidden cursor-pointer hover:border-white/30 transition-colors block ${aspect}`}
        aria-labelledby={`${inputId}-label`}
      >
        {value ? (
          <Image src={value} alt={label} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageIcon size={20} className="text-white/30" aria-hidden="true" />
            <span className="text-xs text-white/40">Click to upload</span>
          </div>
        )}

        {progress > 0 && progress < 100 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <Loader2 size={20} className="text-white animate-spin mx-auto mb-1" aria-hidden="true" />
              <span className="text-xs text-white">{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange(file)
          }}
        />
      </label>
    </div>
  )
}

export function CreateWebtoonModal({
  authorId,
  authorName,
  authorPhotoURL,
  editWebtoon,
  onClose,
  onCreated,
}: Props) {
  const isEditing = !!editWebtoon

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editWebtoon?.title ?? '',
      synopsis: editWebtoon?.synopsis ?? '',
      genres: editWebtoon?.genres ?? [],
      tags: editWebtoon?.tags ?? [],
      status: (editWebtoon?.status as FormData['status']) ?? 'draft',
      visibility: 'public',
    },
  })

  const [coverURL, setCoverURL] = useState<string | null>(editWebtoon?.coverURL ?? null)
  const [coverProgress, setCoverProgress] = useState(0)
  const [newTag, setNewTag] = useState('')
  const [genreOpen, setGenreOpen] = useState(false)

  const selectedGenres = watch('genres')
  const tags = watch('tags')

  const handleCoverUpload = useCallback(
    async (file: File, webtoonId: string) => {
      const url = await uploadWebtoonCover(webtoonId, file, ({ progress }) =>
        setCoverProgress(progress)
      )
      setCoverURL(url)
      return url
    },
    []
  )

  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [aiPanel, setAiPanel] = useState<'cover' | null>(null)
  const [synopsisLoading, setSynopsisLoading] = useState(false)

  function handleCoverFile(file: File) {
    setPendingCover(file)
    setCoverURL(URL.createObjectURL(file))
  }

  async function handleSynopsisAI(action: 'generate-synopsis' | 'improve-synopsis' | 'expand-synopsis') {
    const currentTitle = watch('title')
    const currentSynopsis = watch('synopsis')
    if (!currentTitle && action !== 'generate-synopsis') {
      toast.error('Enter a title first')
      return
    }
    setSynopsisLoading(true)
    try {
      const res = await fetch('/api/ai/novel-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          novelTitle: currentTitle || 'Untitled Webtoon',
          currentSynopsis,
        }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok) throw new Error(data.error)
      if (data.result) {
        setValue('synopsis', data.result)
        toast.success('Synopsis updated!')
      }
    } catch {
      toast.error('Could not generate synopsis — check ANTHROPIC_API_KEY')
    } finally {
      setSynopsisLoading(false)
    }
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (tag && !tags.includes(tag) && tags.length < 10) {
        setValue('tags', [...tags, tag])
      }
      setNewTag('')
    }
  }

  async function onSubmit(data: FormData) {
    try {
      let finalCoverURL = editWebtoon?.coverURL ?? null

      if (isEditing && editWebtoon) {
        if (pendingCover) {
          finalCoverURL = await handleCoverUpload(pendingCover, editWebtoon.id)
        }
        await updateWebtoon(editWebtoon.id, {
          ...data,
          genres: data.genres as Webtoon['genres'],
          coverURL: finalCoverURL,
        })
        toast.success('Webtoon updated')
      } else {
        const tempId = Math.random().toString(36).substring(7)
        if (pendingCover) {
          finalCoverURL = await handleCoverUpload(pendingCover, tempId)
        }
        const newId = await createWebtoon(authorId, authorName, authorPhotoURL, {
          ...data,
          genres: data.genres as Webtoon['genres'],
          coverURL: finalCoverURL,
        })
        toast.success('Webtoon created')
        onCreated(newId)
      }
      onClose()
    } catch {
      toast.error('Failed to save webtoon')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-bg-card border border-bg-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-white">
            {isEditing ? 'Edit Webtoon Properties' : 'Create New Webtoon'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close modal"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Col: Cover */}
            <div className="space-y-4">
              <UploadBox
                label="Cover Art (2:3)"
                aspect="aspect-[2/3] max-w-[200px] mx-auto"
                value={coverURL}
                progress={coverProgress}
                onChange={handleCoverFile}
              />
              <button
                type="button"
                onClick={() => setAiPanel('cover')}
                className="w-full btn-ghost border border-bg-border text-xs flex items-center justify-center gap-1.5 py-2 hover:border-accent/40"
              >
                <Sparkles size={13} className="text-accent" aria-hidden="true" />
                Generate Cover with AI
              </button>

              {aiPanel === 'cover' && (
                <div className="mt-4 border border-bg-border rounded-xl p-3 bg-bg-elevated/40">
                  <AIImageGenerator
                    novelTitle={watch('title') || 'Untitled Webtoon'}
                    novelSynopsis={watch('synopsis') || ''}
                    imageType="cover"
                    onAccept={handleCoverFile}
                    onClose={() => setAiPanel(null)}
                  />
                </div>
              )}
            </div>

            {/* Right Col: Fields */}
            <div className="md:col-span-2 space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="wt-title" className="text-xs font-semibold text-white/50 block mb-1">
                  Title
                </label>
                <input
                  id="wt-title"
                  type="text"
                  placeholder="Enter webtoon title…"
                  className="input-base w-full text-sm"
                  aria-invalid={errors.title ? 'true' : 'false'}
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-xs text-danger mt-1">{errors.title.message}</p>
                )}
              </div>

              {/* Synopsis */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="wt-synopsis" className="text-xs font-semibold text-white/50 block">
                    Synopsis / Description
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSynopsisAI('generate-synopsis')}
                      disabled={synopsisLoading}
                      className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
                    >
                      <Wand2 size={10} aria-hidden="true" />
                      AI Generate
                    </button>
                    <span className="text-white/20 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => handleSynopsisAI('improve-synopsis')}
                      disabled={synopsisLoading}
                      className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
                    >
                      AI Improve
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    id="wt-synopsis"
                    placeholder="Provide a compelling synopsis of your story…"
                    rows={4}
                    className="input-base w-full text-sm pr-10 resize-none"
                    aria-invalid={errors.synopsis ? 'true' : 'false'}
                    {...register('synopsis')}
                  />
                  {synopsisLoading && (
                    <div className="absolute right-3 bottom-3">
                      <Loader2 size={16} className="text-white animate-spin" aria-hidden="true" />
                    </div>
                  )}
                </div>
                {errors.synopsis && (
                  <p className="text-xs text-danger mt-1">{errors.synopsis.message}</p>
                )}
              </div>

              {/* Genres Selector */}
              <div>
                <label className="text-xs font-semibold text-white/50 block mb-1">
                  Genres (1 - 5)
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGenreOpen((v) => !v)}
                    className="w-full flex items-center justify-between input-base text-sm text-left"
                    aria-haspopup="listbox"
                    {...(genreOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
                  >
                    <span>
                      {selectedGenres.length === 0
                        ? 'Select genres…'
                        : selectedGenres.map((g) => g.toUpperCase()).join(', ')}
                    </span>
                    <ChevronDown size={14} className="text-white/40" aria-hidden="true" />
                  </button>

                  {genreOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setGenreOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        role="listbox"
                        aria-multiselectable="true"
                        className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-bg-elevated border border-bg-border rounded-xl shadow-2xl z-20 p-2 grid grid-cols-2 gap-1"
                      >
                        {GENRES.map((g) => {
                          const isSelected = selectedGenres.includes(g)
                          return (
                            <button
                              key={g}
                              type="button"
                              role="option"
                              aria-selected={isSelected ? 'true' : 'false'}
                              onClick={() => {
                                if (isSelected) {
                                  setValue(
                                    'genres',
                                    selectedGenres.filter((x) => x !== g)
                                  )
                                } else if (selectedGenres.length < 5) {
                                  setValue('genres', [...selectedGenres, g])
                                }
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5 ${
                                isSelected ? 'text-accent font-semibold bg-accent/5' : 'text-white/60'
                              }`}
                            >
                              <span className="capitalize">{g.replace('-', ' ')}</span>
                              {isSelected && <Check size={12} aria-hidden="true" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
                {errors.genres && (
                  <p className="text-xs text-danger mt-1">{errors.genres.message}</p>
                )}
              </div>

              {/* Tags Input */}
              <div>
                <label htmlFor="wt-tags-input" className="text-xs font-semibold text-white/50 block mb-1">
                  Tags (Press Enter or comma to add)
                </label>
                <div className="flex flex-wrap gap-2 p-2 bg-bg border border-bg-border rounded-xl min-h-[42px] items-center">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-[11px] bg-white/5 border border-white/10 text-white/80 pl-2 pr-1 py-0.5 rounded-md"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setValue('tags', tags.filter((x) => x !== tag))}
                        className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {tags.length < 10 && (
                    <input
                      id="wt-tags-input"
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={addTag}
                      placeholder={tags.length === 0 ? 'fantasy, strong-lead…' : ''}
                      className="flex-1 bg-transparent border-0 outline-none text-xs p-0 focus-visible:ring-0 placeholder:text-white/20 min-w-[120px]"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label htmlFor="wt-status" className="text-xs font-semibold text-white/50 block mb-1">
                    Status
                  </label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <select
                        id="wt-status"
                        className="select-base w-full text-sm"
                        {...field}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label htmlFor="wt-visibility" className="text-xs font-semibold text-white/50 block mb-1">
                    Visibility
                  </label>
                  <Controller
                    control={control}
                    name="visibility"
                    render={({ field }) => (
                      <select
                        id="wt-visibility"
                        className="select-base w-full text-sm"
                        {...field}
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-bg-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-sm px-4 py-2"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-accent text-sm px-5 py-2 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Save Webtoon'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
