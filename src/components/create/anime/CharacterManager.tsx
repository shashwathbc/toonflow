'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import {
  createCharacter,
  deleteCharacter,
  subscribeToCharacters,
  updateCharacter,
  type CharacterInput,
} from '@/lib/firebase/anime'
import { uploadAnimeCharacterImage } from '@/lib/firebase/storage'
import { validateArtworkFile } from '@/lib/art/validation'
import { VOICE_PRESETS } from '@/lib/anime/presets'
import type { AnimeCharacter } from '@/types/anime'

const EMPTY: CharacterInput = {
  name: '',
  appearance: '',
  clothing: '',
  hair: '',
  eyes: '',
  age: '',
  personality: '',
  voice: '',
  referenceImages: [],
}

const FIELDS = [
  { key: 'hair', label: 'Hair', placeholder: 'Long silver, tied back' },
  { key: 'eyes', label: 'Eyes', placeholder: 'Sharp amber' },
  { key: 'age', label: 'Age', placeholder: 'Late teens' },
  { key: 'clothing', label: 'Clothing', placeholder: 'Black high-collar coat, red sash' },
] as const

const MAX_REFERENCE_IMAGES = 4

/**
 * The character roster — the mechanism behind character consistency.
 *
 * A character is a STORED description with a stable id. Attaching it to a scene
 * means the same words are fed to every generation that references it, which is
 * why a character stays recognisable across clips instead of being re-invented
 * each time. The server re-reads the character from the owner's own collection
 * at submit time, so the id is the only thing the client actually controls.
 */
export default function CharacterManager({ compact = false }: { compact?: boolean }) {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid ?? null

  const [characters, setCharacters] = useState<AnimeCharacter[]>([])
  // Which uid the current list belongs to. Deriving `loading` from this rather
  // than setting a flag in the effect body keeps the write inside the
  // subscription callback (react-hooks/set-state-in-effect).
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  const loading = uid !== null && loadedUid !== uid
  const [editing, setEditing] = useState<AnimeCharacter | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<CharacterInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AnimeCharacter | null>(null)

  useEffect(() => {
    if (!uid) return
    return subscribeToCharacters(
      uid,
      (next) => {
        setCharacters(next)
        setLoadedUid(uid)
      },
      () => {
        toast.error('Could not load your characters')
        setLoadedUid(uid)
      },
    )
  }, [uid])

  const openCreate = useCallback(() => {
    setDraft(EMPTY)
    setEditing(null)
    setCreating(true)
  }, [])

  const openEdit = useCallback((character: AnimeCharacter) => {
    // Only the editable fields go into the draft — id/ownerId/timestamps are
    // server-owned and must never be echoed back on save.
    setDraft({
      name: character.name,
      appearance: character.appearance,
      clothing: character.clothing,
      hair: character.hair,
      eyes: character.eyes,
      age: character.age,
      personality: character.personality,
      voice: character.voice,
      referenceImages: character.referenceImages,
    })
    setEditing(character)
    setCreating(true)
  }, [])

  const handleUpload = useCallback(
    async (file: File) => {
      if (!uid) return
      if (draft.referenceImages.length >= MAX_REFERENCE_IMAGES) {
        toast.error(`Up to ${MAX_REFERENCE_IMAGES} reference images`)
        return
      }
      // Sniff the real container before uploading — the declared MIME type on a
      // File is attacker-controlled metadata, so it proves nothing on its own.
      const check = await validateArtworkFile(file)
      if (!check.ok) {
        toast.error(check.message ?? 'That file could not be used')
        return
      }
      if (check.detectedMime === 'image/svg+xml') {
        toast.error('Reference images must be PNG, JPG or WebP')
        return
      }

      setUploading(true)
      try {
        // A character needs an id before its images can be pathed under it, so an
        // unsaved draft is persisted first.
        let characterId = editing?.id
        if (!characterId) {
          characterId = await createCharacter(uid, { ...draft, name: draft.name || 'Untitled character' })
          const created = { ...draft, id: characterId } as AnimeCharacter
          setEditing(created)
        }
        const url = await uploadAnimeCharacterImage(uid, characterId, file, draft.referenceImages.length)
        const next = [...draft.referenceImages, url]
        setDraft((prev) => ({ ...prev, referenceImages: next }))
        await updateCharacter(characterId, { referenceImages: next })
        toast.success('Reference image added')
      } catch (err) {
        console.error('[CharacterManager] upload failed', err)
        toast.error('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    },
    [uid, draft, editing],
  )

  const save = useCallback(async () => {
    if (!uid) return
    const name = draft.name.trim()
    if (!name) {
      toast.error('Give the character a name')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCharacter(editing.id, { ...draft, name })
        toast.success('Character updated')
      } else {
        await createCharacter(uid, { ...draft, name })
        toast.success('Character created')
      }
      setCreating(false)
      setEditing(null)
      setDraft(EMPTY)
    } catch (err) {
      console.error('[CharacterManager] save failed', err)
      toast.error('Could not save that character')
    } finally {
      setSaving(false)
    }
  }, [uid, draft, editing])

  const remove = useCallback(async () => {
    if (!confirmDelete) return
    try {
      await deleteCharacter(confirmDelete.id)
      toast.success('Character deleted')
    } catch {
      toast.error('Could not delete that character')
    } finally {
      setConfirmDelete(null)
    }
  }, [confirmDelete])

  return (
    <section id="characters" aria-labelledby="characters-heading" className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-studio-anime" aria-hidden="true" />
          <h2 id="characters-heading" className="text-lg font-bold text-text lg:text-xl">
            Characters
          </h2>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bg-border px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:border-studio-anime/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-anime"
        >
          <Plus size={15} aria-hidden="true" />
          New character
        </button>
      </div>

      <p className="mb-4 max-w-2xl text-sm text-text-secondary">
        Attach a character to any scene and its description is sent with every generation, so the same
        face, hair and outfit carry across your whole story.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" aria-label="Loading character…" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bg-border bg-bg-card px-6 py-10 text-center">
          <p className="text-sm font-semibold text-text">No characters yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-secondary">
            Create one so your cast stays recognisable from scene to scene.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {characters.map((character) => (
            <li
              key={character.id}
              className="flex flex-col rounded-xl border border-bg-border bg-bg-card p-4 transition-colors hover:border-studio-anime/30"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-bg-border bg-bg-elevated">
                  {character.referenceImages[0] ? (
                    <Image
                      src={character.referenceImages[0]}
                      alt={`Reference art for ${character.name}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text-muted">
                      {character.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">{character.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                    {[character.hair, character.eyes, character.clothing].filter(Boolean).join(' · ') ||
                      'No description yet'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(character)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-bg-border px-2 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Pencil size={12} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(character)}
                  className="rounded-lg border border-bg-border px-2 py-1.5 text-text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                  aria-label={`Delete ${character.name}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        title={editing ? `Edit ${editing.name || 'character'}` : 'New character'}
        description="Everything you write here is sent with every scene this character appears in."
        className={compact ? 'max-w-lg' : 'max-w-2xl'}
      >
        <form
          className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div>
            <label htmlFor="character-name" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Name
            </label>
            <input
              id="character-name"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              maxLength={80}
              required
              className="input-base w-full"
              placeholder="Kaito"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={`character-${field.key}`}
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  {field.label}
                </label>
                <input
                  id={`character-${field.key}`}
                  value={draft[field.key]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  maxLength={200}
                  className="input-base w-full"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="character-appearance" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Appearance
            </label>
            <textarea
              id="character-appearance"
              value={draft.appearance}
              onChange={(event) => setDraft((prev) => ({ ...prev, appearance: event.target.value }))}
              maxLength={1000}
              rows={3}
              className="input-base w-full resize-none"
              placeholder="Tall and lean, a faded scar across the left cheek, always slightly hunched"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="character-personality"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Personality
              </label>
              <input
                id="character-personality"
                value={draft.personality}
                onChange={(event) => setDraft((prev) => ({ ...prev, personality: event.target.value }))}
                maxLength={200}
                className="input-base w-full"
                placeholder="Quiet, stubborn, quick to act"
              />
            </div>
            <div>
              <label htmlFor="character-voice" className="mb-1.5 block text-sm font-medium text-text-secondary">
                Voice
              </label>
              <select
                id="character-voice"
                value={draft.voice}
                onChange={(event) => setDraft((prev) => ({ ...prev, voice: event.target.value }))}
                className="input-base w-full"
              >
                {VOICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Reference images <span className="text-text-muted">(up to {MAX_REFERENCE_IMAGES})</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {draft.referenceImages.map((url, index) => (
                <div
                  key={url}
                  className="relative h-16 w-16 overflow-hidden rounded-lg border border-bg-border bg-bg-elevated"
                >
                  <Image src={url} alt={`Reference ${index + 1}`} fill sizes="64px" className="object-cover" />
                </div>
              ))}
              {draft.referenceImages.length < MAX_REFERENCE_IMAGES && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-bg-border-strong text-text-muted transition-colors hover:border-studio-anime/50 hover:text-studio-anime focus-within:ring-2 focus-within:ring-studio-anime">
                  <Plus size={18} aria-hidden="true" />
                  <span className="sr-only">Add a reference image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void handleUpload(file)
                    }}
                  />
                </label>
              )}
            </div>
            {uploading && (
              <p className="mt-2 text-xs text-text-muted" role="status">
                Uploading…
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving || !draft.name.trim()} className="btn-accent px-4 py-2 text-sm">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create character'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete character?"
        description={
          confirmDelete
            ? `“${confirmDelete.name}” will be removed. Scenes that reference it keep their prompts but lose the shared description.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmDelete(null)} className="btn-ghost px-4 py-2 text-sm">
            Keep
          </button>
          <button type="button" onClick={() => void remove()} className="btn-danger px-4 py-2 text-sm">
            Delete
          </button>
        </div>
      </Modal>
    </section>
  )
}
