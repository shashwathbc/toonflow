'use client'

import { useState } from 'react'
import { X, Loader2, UploadCloud, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { createCharacter, updateCharacter } from '@/lib/firebase/firestore'
import { uploadCharacterImage } from '@/lib/firebase/storage'
import { cn } from '@/lib/utils/cn'
import type { Character } from '@/types'

const COLORS = ['#4C9AFF', '#A855F7', '#F59E0B', '#EC4899', '#22C55E', '#EF4444', '#14B8A6', '#6366F1']

interface Props {
  uid: string
  webtoonId: string
  /** null = create a new character */
  character: Character | null
  onClose: () => void
}

export function CharacterDialog({ uid, webtoonId, character, onClose }: Props) {
  const editing = !!character
  const [name, setName] = useState(character?.name ?? '')
  const [role, setRole] = useState(character?.role ?? '')
  const [notes, setNotes] = useState(character?.notes ?? '')
  const [color, setColor] = useState(character?.color ?? COLORS[0])
  const [imageUrl, setImageUrl] = useState<string | null>(character?.imageUrl ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(character?.imageUrl ?? null)
  const [saving, setSaving] = useState(false)

  const onPickImage = (file: File | undefined) => {
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImageUrl(null)
    setPreview(null)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Give your character a name')
      return
    }
    setSaving(true)
    try {
      const charId = editing
        ? character!.id
        : await createCharacter(webtoonId, { name: trimmed, role: role.trim(), color, notes: notes.trim() })

      let finalImageUrl = imageUrl
      if (imageFile) {
        finalImageUrl = await uploadCharacterImage(uid, webtoonId, charId, imageFile)
      }

      await updateCharacter(webtoonId, charId, {
        name: trimmed,
        role: role.trim(),
        color,
        notes: notes.trim(),
        imageUrl: finalImageUrl ?? null,
      })

      toast.success(editing ? 'Character updated' : 'Character added')
      onClose()
    } catch (err) {
      console.error('Save character failed', err)
      toast.error('Could not save character')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#262626]">
          <h2 className="text-sm font-semibold text-white">{editing ? 'Edit Character' : 'New Character'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C9AFF]">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            <label className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer group focus-within:ring-2 focus-within:ring-[#4C9AFF]">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, #1a1a1a)` }}>
                  <User size={22} className="text-white/70" aria-hidden="true" />
                </span>
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <UploadCloud size={18} className="text-white" aria-hidden="true" />
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <div className="text-[11px] text-white/45 leading-relaxed">
              Reference portrait (optional).
              {preview && (
                <button onClick={removeImage} className="block mt-1 text-danger hover:underline">Remove image</button>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="char-name" className="block text-[11px] font-medium text-white/60 mb-1">Name</label>
            <input
              id="char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Ravana"
              className="w-full rounded-lg bg-[#111] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none px-3 py-2 text-sm text-white placeholder:text-white/25"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="char-role" className="block text-[11px] font-medium text-white/60 mb-1">Role</label>
            <input
              id="char-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={40}
              placeholder="e.g. Protagonist"
              className="w-full rounded-lg bg-[#111] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none px-3 py-2 text-sm text-white placeholder:text-white/25"
            />
          </div>

          {/* Color */}
          <div>
            <span className="block text-[11px] font-medium text-white/60 mb-1.5">Label colour</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  className={cn('w-6 h-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white', color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-110')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="char-notes" className="block text-[11px] font-medium text-white/60 mb-1">Notes <span className="text-white/30">(optional)</span></label>
            <textarea
              id="char-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              placeholder="Appearance, outfit, personality — keeps them consistent."
              className="w-full h-20 resize-none rounded-lg bg-[#111] border border-[#2A2A2A] focus:border-[#4C9AFF] outline-none px-3 py-2 text-xs text-white placeholder:text-white/25"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#262626] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#4C9AFF] text-white hover:bg-[#4C9AFF]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {saving && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {editing ? 'Save' : 'Add character'}
          </button>
        </div>
      </div>
    </div>
  )
}
