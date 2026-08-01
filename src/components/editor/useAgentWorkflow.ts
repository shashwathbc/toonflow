'use client'

import { useCallback, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useEditorStore } from '@/store/useEditorStore'
import { getWebtoonById, listCharacters, createCharacter } from '@/lib/firebase/firestore'
import { makeSfxTextSpec } from '@/lib/editor/panelArt'
import type { BubbleKind } from '@/lib/editor/bubbles'
import { panelSize } from '@/lib/editor/webtoonFormat'

// `position` is one of nine placement zones the storyboard picks so dialogue
// lands in the panel's negative space instead of over the art (see BubblePos).
interface StoryBubble { kind: BubbleKind; text: string; position?: string }
// `cast` names the characters present so only their looks are prepended to this
// panel's art prompt; `sfx` are onomatopoeia rendered as big caption lettering.
export interface StoryPanel { scene: string; shot?: string; palette?: string; motion?: string; cast?: string[]; sfx?: string[]; bubbles: StoryBubble[] }
// A named cast member with a locked look, saved to the character roster.
interface StoryCharacter { name: string; look: string }

// Swatch colours cycled through when auto-creating cast in the roster.
const CAST_COLORS = ['#4C9AFF', '#A855F7', '#F59E0B', '#EC4899', '#22C55E', '#EF4444']

/**
 * Save the storyboard's cast to the webtoon's character roster (left sidebar) so
 * the creator can reuse them on any page. Best-effort and deduped by name against
 * the existing roster — re-running the plan never piles up duplicates. Each
 * character's locked look is stored in `notes`. Returns how many were created.
 */
async function saveCastToRoster(webtoonId: string, cast: StoryCharacter[]): Promise<number> {
  try {
    const existing = await listCharacters(webtoonId)
    const have = new Set(existing.map((c) => c.name.trim().toLowerCase()))
    let created = 0
    for (let i = 0; i < cast.length; i++) {
      const name = cast[i].name.trim()
      const key = name.toLowerCase()
      if (!name || have.has(key)) continue
      have.add(key)
      await createCharacter(webtoonId, {
        name,
        role: 'AI cast',
        color: CAST_COLORS[i % CAST_COLORS.length],
        notes: cast[i].look,
      })
      created++
    }
    return created
  } catch {
    return 0 // roster save is a convenience, never fail the whole plan on it
  }
}

// Storyboard placement zone → fractional center on the page (0–1).
const BUBBLE_POS: Record<string, { x: number; y: number }> = {
  'top-left': { x: 0.3, y: 0.18 },   'top-center': { x: 0.5, y: 0.18 },   'top-right': { x: 0.7, y: 0.18 },
  'mid-left': { x: 0.3, y: 0.5 },    center: { x: 0.5, y: 0.5 },          'mid-right': { x: 0.7, y: 0.5 },
  'bottom-left': { x: 0.3, y: 0.82 },'bottom-center': { x: 0.5, y: 0.82 },'bottom-right': { x: 0.7, y: 0.82 },
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const TARGET_PANELS = 20

// One-shot, page-wise workflow: Generate Story Plan → the Story Director plans
// the chapter AND we immediately lay out every page (its art prompt + speech
// bubbles) on the canvas. No separate "template" build step and no batch paint —
// the creator then generates each page's art ONE AT A TIME from the right
// sidebar (see PanelArtSection / regeneratePanelArt), reviewing/approving each
// before spending on the next.
export type WorkflowState = 'idle' | 'planning' | 'ready' | 'error'

export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle')
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [character, setCharacter] = useState('')

  // Use a ref to immediately signal cancellation to any running async loop.
  const cancelRef = useRef(false)

  const reset = useCallback(() => {
    cancelRef.current = true
    setWorkflowState('idle')
    setProgress(null)
    setResult(null)
    setPageCount(0)
    setCharacter('')
  }, [])

  // Generate Story Plan: plan the chapter, then lay out ALL pages directly so
  // each page arrives with its AI-art prompt ready to generate page-by-page.
  const generatePlan = useCallback(async (script: string) => {
    if (workflowState === 'planning') return
    const trimmed = script.trim()
    if (trimmed.length < 4) {
      toast.error('Type a chapter brief or paste your script first')
      return
    }
    if (
      useEditorStore.getState().pages.length > 0 &&
      typeof window !== 'undefined' &&
      !window.confirm('Start a fresh chapter? This clears everything currently on the canvas.')
    ) {
      return
    }

    cancelRef.current = false
    setWorkflowState('planning')
    setResult(null)
    setPageCount(0)
    setCharacter('')

    try {
      const ctx = useEditorStore.getState().assetCtx
      let title = ''
      let synopsis = ''
      if (ctx?.webtoonId) {
        try {
          const wt = await getWebtoonById(ctx.webtoonId)
          if (wt) {
            title = wt.title ?? ''
            synopsis = wt.synopsis ?? ''
          }
        } catch {}
      }

      setProgress('Story Director is planning the chapter…')
      const sres = await fetch('/api/ai/storyboard', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ script: trimmed, title, synopsis, panels: TARGET_PANELS }),
      })
      if (cancelRef.current) return

      const sdata = (await sres.json()) as { character?: string; characters?: StoryCharacter[]; style?: string; panels?: StoryPanel[]; error?: string }
      if (!sres.ok) throw new Error(sdata.error ?? 'Planning failed')
      const panels = sdata.panels ?? []
      if (panels.length === 0) throw new Error('No panels were produced')

      // The chapter's cast, keyed by name → look, so each panel prepends ONLY the
      // looks of the characters actually in it ("if characters present, their
      // description"). Environment-only panels prepend nothing.
      const cast = sdata.characters ?? []
      const lookByName = new Map(cast.map((c) => [c.name.trim().toLowerCase(), c.look]))
      const hasRoster = cast.length > 0

      // Save the cast to the left-sidebar roster for reuse (best effort).
      if (ctx?.webtoonId && cast.length) {
        setProgress('Saving the cast to your character roster…')
        const made = await saveCastToRoster(ctx.webtoonId, cast)
        if (cancelRef.current) return
        if (made) toast.success(`${made} character${made > 1 ? 's' : ''} added to your roster`)
      }

      // Lay out the pages immediately — no intermediate "template" review.
      if (cancelRef.current) return
      setProgress(`Laying out ${panels.length} pages…`)
      const store = useEditorStore.getState()
      store.loadProject(null)
      // Prepended to every panel so the whole chapter shares one locked look/grade.
      const stylePrefix = sdata.style ? `${sdata.style}. ` : ''
      // Legacy single-character fallback for when the model returned no cast array.
      const legacyCharacterPrefix = sdata.character ? `${sdata.character}. ` : ''
      // One seed for the WHOLE chapter → every panel renders with coherent global
      // lighting/line-weight, so stacked panels don't jump in tone at the seam.
      const chapterSeed = Math.floor(Math.random() * 900_000)
      let firstPageId: string | null = null

      for (const panel of panels) {
        if (cancelRef.current) return
        // Prepend ONLY the looks of the characters present in this panel; nothing
        // for an environment-only shot. Fall back to the legacy single character
        // when the model returned no cast array at all.
        const castLooks = (panel.cast ?? [])
          .map((n) => lookByName.get(n.trim().toLowerCase()))
          .filter((l): l is string => !!l)
        const castPrefix = hasRoster
          ? castLooks.length
            ? `${castLooks.join('. ')}. `
            : ''
          : legacyCharacterPrefix
        // style (locked grade) → cast (locked looks) → scene → 60/30/10 palette
        const palette = panel.palette ? `. Color: ${panel.palette}` : ''
        const artPrompt = stylePrefix + castPrefix + panel.scene + palette
        // Size the page to the shot so establishing shots are tall and reaction
        // beats short — the varying height is what gives the scroll its rhythm and
        // the page matches the render aspect exactly so art fills it edge-to-edge.
        const { width, height } = panelSize(panel.shot)
        // Stash prompt/shot/seed on the page so it can be generated (and later
        // re-generated) per page WITHOUT re-running the storyboard. Each page
        // starts 'ready' so the page-by-page gate makes only the first one
        // workable and unlocks the rest as they're approved.
        const pageId = store.addPage(
          { artPrompt, artShot: panel.shot, artSeed: chapterSeed, status: 'ready', width, height },
          'webtoon',
        )
        if (!firstPageId) firstPageId = pageId
        const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
        if (!page) continue
        const n = panel.bubbles.length || 1
        panel.bubbles.forEach((b, idx) => {
          const zone = b.position ? BUBBLE_POS[b.position] : undefined
          // Reading-order fallback keeps un-positioned bubbles legible top→bottom.
          const fallbackY = 0.16 + (0.68 * (idx + 0.5)) / n
          const xFrac = zone ? zone.x : 0.5
          // Bias toward the chosen zone but spread stacked bubbles by index so two
          // bubbles sharing a zone don't overlap; clamp inside the safe band.
          const yFrac = zone
            ? Math.max(0.14, Math.min(0.86, zone.y + (idx - (n - 1) / 2) * 0.14))
            : fallbackY
          const id = store.addBubble(pageId, b.kind, page.width * xFrac, page.height * yFrac)
          if (id) useEditorStore.getState().updateElement(pageId, id, { text: b.text }, false)
        })
        // Onomatopoeia as big caption lettering, staggered down the right side so
        // it reads as SFX on the art rather than dialogue.
        ;(panel.sfx ?? []).forEach((s, idx) => {
          const cx = page.width * 0.66
          const cy = page.height * Math.min(0.86, 0.24 + 0.18 * idx)
          store.addElement(pageId, makeSfxTextSpec(s, page, cx, cy))
        })
      }

      useEditorStore.getState().clearSelection()
      useEditorStore.getState().mergeEpisode()
      useEditorStore.getState().fitWidth()
      if (cancelRef.current) return

      // Open the first page so the creator can generate it straight away — the
      // page-by-page gate keeps every later page locked until this one's approved.
      if (firstPageId) {
        useEditorStore.getState().selectPage(firstPageId)
        useEditorStore.getState().fitPage(firstPageId)
      }

      // Summarise the cast by name for the panel; fall back to the single look.
      setCharacter(cast.length ? cast.map((c) => c.name).join(', ') : sdata.character ?? '')
      setPageCount(panels.length)
      setResult(`Laid out ${panels.length} pages. Open each page and press “Generate this page”.`)
      setWorkflowState('ready')
      setProgress(null)
      toast.success('Pages ready — generate each one from the right sidebar.')
    } catch (err) {
      if (cancelRef.current) return
      const msg = err instanceof Error ? err.message : 'Workflow failed'
      setResult(`Failed: ${msg}`)
      toast.error(msg)
      setWorkflowState('error')
      setProgress(null)
    }
  }, [workflowState])

  return {
    workflowState,
    progress,
    result,
    pageCount,
    character,
    generatePlan,
    reset,
  }
}
