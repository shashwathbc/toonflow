'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
import { createNovel, updateNovel } from '@/lib/firebase/firestore'
import { uploadNovelCover, uploadNovelBanner } from '@/lib/firebase/storage'
import { GENRES } from '@/lib/utils/constants'
import { slugify } from '@/lib/utils/formatters'
import type { Novel } from '@/types'
import { AIImageGenerator } from './AIImageGenerator'

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
  editNovel?: Novel | null
  onClose: () => void
  onCreated: (id: string) => void
  userId?: string
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
      {/* label wraps the file input — no nested interactive controls */}
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

export function CreateNovelModal({
  authorId,
  authorName,
  authorPhotoURL,
  editNovel,
  onClose,
  onCreated,
  userId,
}: Props) {
  const isEditing = !!editNovel

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
      title: editNovel?.title ?? '',
      synopsis: editNovel?.synopsis ?? '',
      genres: editNovel?.genres ?? [],
      tags: editNovel?.tags ?? [],
      status: (editNovel?.status as FormData['status']) ?? 'draft',
      visibility: 'public',
    },
  })

  const [coverURL, setCoverURL] = useState<string | null>(editNovel?.coverURL ?? null)
  const [bannerURL, setBannerURL] = useState<string | null>(editNovel?.bannerURL ?? null)
  const [coverProgress, setCoverProgress] = useState(0)
  const [bannerProgress, setBannerProgress] = useState(0)
  const [newTag, setNewTag] = useState('')
  const [genreOpen, setGenreOpen] = useState(false)

  const selectedGenres = watch('genres')
  const tags = watch('tags')

  const handleCoverUpload = useCallback(
    async (file: File, novelId: string) => {
      const url = await uploadNovelCover(novelId, file, ({ progress }) =>
        setCoverProgress(progress)
      )
      setCoverURL(url)
      return url
    },
    []
  )

  const handleBannerUpload = useCallback(
    async (file: File, novelId: string) => {
      const url = await uploadNovelBanner(novelId, file, ({ progress }) =>
        setBannerProgress(progress)
      )
      setBannerURL(url)
      return url
    },
    []
  )

  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [pendingBanner, setPendingBanner] = useState<File | null>(null)
  const [aiPanel, setAiPanel] = useState<'cover' | 'banner' | null>(null)
  const [synopsisLoading, setSynopsisLoading] = useState(false)

  const coverObjectURL = useRef<string | null>(null)
  const bannerObjectURL = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (coverObjectURL.current) URL.revokeObjectURL(coverObjectURL.current)
      if (bannerObjectURL.current) URL.revokeObjectURL(bannerObjectURL.current)
    }
  }, [])

  function handleCoverFile(file: File) {
    if (coverObjectURL.current) URL.revokeObjectURL(coverObjectURL.current)
    const url = URL.createObjectURL(file)
    coverObjectURL.current = url
    setPendingCover(file)
    setCoverURL(url)
  }

  function handleBannerFile(file: File) {
    if (bannerObjectURL.current) URL.revokeObjectURL(bannerObjectURL.current)
    const url = URL.createObjectURL(file)
    bannerObjectURL.current = url
    setPendingBanner(file)
    setBannerURL(url)
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
          novelTitle: currentTitle || 'Untitled Novel',
          currentSynopsis,
          userId,
        }),
      })
      const data = await res.json() as { result?: string; error?: string; insufficientTokens?: boolean }
      if (!res.ok) {
        if (data.insufficientTokens) {
          toast.error(data.error ?? 'Not enough tokens', { duration: 6000 })
          return
        }
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      if (data.result) {
        setValue('synopsis', data.result)
        toast.success('Synopsis updated!')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate synopsis'
      toast.error(msg)
      console.error('[CreateNovelModal] Synopsis AI error:', err)
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
      let finalCoverURL = editNovel?.coverURL ?? null
      let finalBannerURL = editNovel?.bannerURL ?? null

      if (isEditing && editNovel) {
        // Upload images if pending
        if (pendingCover) {
          finalCoverURL = await handleCoverUpload(pendingCover, editNovel.id)
        }
        if (pendingBanner) {
          finalBannerURL = await handleBannerUpload(pendingBanner, editNovel.id)
        }
        await updateNovel(editNovel.id, {
          ...data,
          genres: data.genres as Novel['genres'],
          coverURL: finalCoverURL,
          bannerURL: finalBannerURL,
        })
        toast.success('Novel updated')
        onCreated(editNovel.id)
      } else {
        // Create first, then upload
        const slug = slugify(data.title) + '-' + Date.now().toString(36)
        const id = await createNovel(authorId, authorName, authorPhotoURL, {
          title: data.title,
          slug,
          synopsis: data.synopsis,
          genres: data.genres as Novel['genres'],
          tags: data.tags,
          status: data.status,
          bannerURL: null,
        })

        if (pendingCover) {
          finalCoverURL = await handleCoverUpload(pendingCover, id)
          await updateNovel(id, { coverURL: finalCoverURL })
        }
        if (pendingBanner) {
          finalBannerURL = await handleBannerUpload(pendingBanner, id)
          await updateNovel(id, { bannerURL: finalBannerURL })
        }

        toast.success('Novel created!')
        onCreated(id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
      console.error('[CreateNovelModal] Submit error:', err)
      // Form data is preserved — user can retry
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-novel-title"
    >
      <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border sticky top-0 bg-bg-elevated z-10">
          <h2 id="create-novel-title" className="font-bold text-white text-lg">
            {isEditing ? 'Edit Novel' : 'Create New Novel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close"
          >
            <X size={16} className="text-white/60" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-5 space-y-5">
            {/* Images */}
            <div className="grid grid-cols-3 gap-4">
              {/* Cover */}
              <div className="space-y-2">
                <UploadBox
                  label="Cover Image *"
                  aspect="aspect-[2/3]"
                  value={coverURL}
                  progress={coverProgress}
                  onChange={handleCoverFile}
                />
                <button
                  type="button"
                  onClick={() => setAiPanel(aiPanel === 'cover' ? null : 'cover')}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-bg-border hover:border-white/30 rounded-lg py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                >
                  <Sparkles size={10} aria-hidden="true" />
                  AI Generate
                </button>
              </div>

              {/* Banner */}
              <div className="col-span-2 space-y-2">
                <UploadBox
                  label="Banner Image (optional)"
                  aspect="aspect-[16/9]"
                  value={bannerURL}
                  progress={bannerProgress}
                  onChange={handleBannerFile}
                />
                <button
                  type="button"
                  onClick={() => setAiPanel(aiPanel === 'banner' ? null : 'banner')}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-white/50 hover:text-white border border-bg-border hover:border-white/30 rounded-lg py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                >
                  <Sparkles size={10} aria-hidden="true" />
                  AI Generate
                </button>
              </div>
            </div>

            {/* AI Image Generator panel */}
            {aiPanel && (
              <AIImageGenerator
                novelTitle={watch('title')}
                novelSynopsis={watch('synopsis')}
                imageType={aiPanel}
                userId={userId}
                onAccept={(file) => {
                  if (aiPanel === 'cover') handleCoverFile(file)
                  else handleBannerFile(file)
                  setAiPanel(null)
                }}
                onClose={() => setAiPanel(null)}
              />
            )}

            {/* Title */}
            <div>
              <label htmlFor="novel-title" className="block text-xs font-medium text-white/60 mb-1.5">
                Title *
              </label>
              <input
                id="novel-title"
                {...register('title')}
                className="input-base"
                placeholder="Your novel's title"
                aria-describedby={errors.title ? 'title-error' : undefined}
                {...(errors.title ? { 'aria-invalid': 'true' } : { 'aria-invalid': 'false' })}
              />
              {errors.title && (
                <p id="title-error" className="mt-1 text-xs text-danger" role="alert">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Synopsis */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="novel-synopsis" className="text-xs font-medium text-white/60">
                  Description / Synopsis *
                </label>
                <div className="flex items-center gap-1" role="group" aria-label="AI synopsis tools">
                  <button
                    type="button"
                    onClick={() => handleSynopsisAI('generate-synopsis')}
                    disabled={synopsisLoading}
                    title="Generate synopsis from title"
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-bg-border text-white/40 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  >
                    {synopsisLoading ? (
                      <Loader2 size={9} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={9} aria-hidden="true" />
                    )}
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSynopsisAI('improve-synopsis')}
                    disabled={synopsisLoading}
                    title="Improve existing synopsis"
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-bg-border text-white/40 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  >
                    <Wand2 size={9} aria-hidden="true" />
                    Improve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSynopsisAI('expand-synopsis')}
                    disabled={synopsisLoading}
                    title="Expand synopsis"
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-bg-border text-white/40 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  >
                    <Plus size={9} aria-hidden="true" />
                    Expand
                  </button>
                </div>
              </div>
              <textarea
                id="novel-synopsis"
                {...register('synopsis')}
                rows={4}
                className="input-base resize-none"
                placeholder="Describe your story — or use ✨ Generate above"
                aria-describedby={errors.synopsis ? 'synopsis-error' : undefined}
                {...(errors.synopsis ? { 'aria-invalid': 'true' } : { 'aria-invalid': 'false' })}
              />
              {errors.synopsis && (
                <p id="synopsis-error" className="mt-1 text-xs text-danger" role="alert">
                  {errors.synopsis.message}
                </p>
              )}
            </div>

            {/* Genres */}
            <Controller
              name="genres"
              control={control}
              render={({ field }) => (
                <div>
                  <p className="text-xs font-medium text-white/60 mb-1.5">Genres * (up to 5)</p>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setGenreOpen((v) => !v)}
                      className="input-base flex items-center justify-between cursor-pointer"
                      aria-haspopup="listbox"
                      {...(genreOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
                    >
                      <span className={field.value.length === 0 ? 'text-white/40' : 'text-white'}>
                        {field.value.length === 0
                          ? 'Select genres…'
                          : field.value.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}
                      </span>
                      <ChevronDown size={14} className="text-white/40" aria-hidden="true" />
                    </button>

                    {genreOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setGenreOpen(false)} aria-hidden="true" />
                        <div
                          role="listbox"
                          aria-label="Select genres"
                          aria-multiselectable="true"
                          className="absolute top-full mt-1 left-0 right-0 bg-bg-elevated border border-bg-border rounded-xl shadow-2xl z-20 max-h-52 overflow-y-auto"
                        >
                          <div className="grid grid-cols-2 p-2 gap-1">
                            {GENRES.map((genre) => {
                              const selected = field.value.includes(genre)
                              return selected ? (
                                <button
                                  key={genre}
                                  type="button"
                                  role="option"
                                  aria-selected="true"
                                  onClick={() => {
                                    field.onChange(field.value.filter((g) => g !== genre))
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm capitalize transition-colors bg-white text-bg font-medium"
                                >
                                  <Check size={12} aria-hidden="true" />
                                  {genre}
                                </button>
                              ) : (
                                <button
                                  key={genre}
                                  type="button"
                                  role="option"
                                  aria-selected="false"
                                  onClick={() => {
                                    if (field.value.length < 5) {
                                      field.onChange([...field.value, genre])
                                    }
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm capitalize transition-colors text-white/70 hover:bg-white/10 hover:text-white"
                                >
                                  {genre}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {errors.genres && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors.genres.message}
                    </p>
                  )}
                </div>
              )}
            />

            {/* Tags */}
            <div>
              <label htmlFor="novel-tags" className="block text-xs font-medium text-white/60 mb-1.5">
                Tags (optional, max 10)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-bg-elevated border border-bg-border rounded-lg min-h-[42px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs bg-white/10 text-white px-2 py-1 rounded-full"
                  >
                    <Tag size={9} aria-hidden="true" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => setValue('tags', tags.filter((t) => t !== tag))}
                      className="hover:text-danger ml-0.5 focus-visible:ring-1 focus-visible:ring-white rounded"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X size={10} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {tags.length < 10 && (
                  <input
                    id="novel-tags"
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={addTag}
                    placeholder={tags.length === 0 ? 'Add tags… (Enter to add)' : ''}
                    className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none flex-1 min-w-24"
                    aria-label="Add tag"
                    title="Add tag"
                  />
                )}
              </div>
            </div>

            {/* Status & Visibility */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="novel-status" className="block text-xs font-medium text-white/60 mb-1.5">
                  Status
                </label>
                <select
                  id="novel-status"
                  {...register('status')}
                  className="input-base"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="novel-visibility" className="block text-xs font-medium text-white/60 mb-1.5">
                  Visibility
                </label>
                <select
                  id="novel-visibility"
                  {...register('visibility')}
                  className="input-base"
                >
                  <option value="public">Public — Anyone can read</option>
                  <option value="private">Private — Only you</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-bg-border flex items-center justify-end gap-3 sticky bottom-0 bg-bg-elevated">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-accent"
              aria-label={isEditing ? 'Save novel changes' : 'Create novel'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  {isEditing ? 'Saving…' : 'Creating…'}
                </>
              ) : (
                <>
                  <Plus size={14} aria-hidden="true" />
                  {isEditing ? 'Save Changes' : 'Create Novel'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
