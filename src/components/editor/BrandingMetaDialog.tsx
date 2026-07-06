'use client'

import { useState, useEffect } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import type { Webtoon, Episode } from '@/types'

// Text editor for the mandatory intro/outro branding pages. The pages
// themselves are locked (structural, not panels); only these copy fields are
// user-editable. Empty fields fall back to series-derived defaults, so
// clearing an input restores the default text.

interface FieldSpec {
  key: string
  label: string
  placeholder: string
  maxLength: number
}

interface BrandingMetaDialogProps {
  kind: 'intro' | 'outro'
  webtoon: Webtoon
  episode: Episode
  onClose: () => void
  /** Receives only the non-empty fields; all meta fields are optional strings */
  onSave: (meta: Record<string, string>) => Promise<void>
}

export function BrandingMetaDialog({ kind, webtoon, episode, onClose, onSave }: BrandingMetaDialogProps) {
  const isIntro = kind === 'intro'
  const defaultTagline = (webtoon.synopsis ?? '').split(/[.!?]/)[0]?.trim() ?? ''

  const fields: FieldSpec[] = isIntro
    ? [
        { key: 'tagline', label: 'Tagline', placeholder: defaultTagline || 'A short hook for this episode…', maxLength: 140 },
        { key: 'creditLine', label: 'Story & Art credit', placeholder: webtoon.authorName, maxLength: 80 },
      ]
    : [
        { key: 'message', label: 'Farewell headline', placeholder: 'Thank You for Reading', maxLength: 80 },
        { key: 'teaser', label: 'Teaser', placeholder: 'Next episode coming soon', maxLength: 120 },
        { key: 'handle', label: 'Social handle / link text', placeholder: '@yourhandle', maxLength: 60 },
      ]

  const initialMeta = ((isIntro ? episode.intro : episode.outro) ?? {}) as Record<string, string | undefined>
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initialMeta[f.key] ?? '']))
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    try {
      // Persist only non-empty fields — an empty field means "use the default"
      const meta: Record<string, string> = Object.fromEntries(
        Object.entries(values)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v !== '')
      )
      await onSave(meta)
      onClose()
    } catch {
      // Parent surfaced the error toast — keep the dialog open so edits survive
    } finally {
      setSaving(false)
    }
  }

  const title = isIntro ? 'Edit Intro Page Text' : 'Edit Outro Page Text'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branding-dialog-title"
    >
      {/* Backdrop click target */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div className="relative bg-bg-elevated border border-bg-border rounded-2xl p-6 max-w-md w-full animate-scale-in">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Lock size={16} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 id="branding-dialog-title" className="font-semibold text-white text-base">
              {title}
            </h2>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              This branding page is a permanent part of every episode — only its
              text can be customized. Leave a field empty to use the default.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((field) => {
            const inputId = `branding-${kind}-${field.key}`
            return (
              <div key={field.key}>
                <label htmlFor={inputId} className="block text-xs font-medium text-white/60 mb-1.5">
                  {field.label}
                </label>
                <input
                  id={inputId}
                  type="text"
                  value={values[field.key]}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="input-base text-sm w-full"
                />
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button type="button" onClick={onClose} className="btn-ghost text-sm px-3 py-2" disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-accent text-sm px-4 py-2 flex items-center gap-1.5"
            disabled={saving}
          >
            {saving && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
