'use client'

import { useCallback, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useEditorStore, type Page } from '@/store/useEditorStore'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { getWebtoonById } from '@/lib/firebase/firestore'
import type { BubbleKind } from '@/lib/editor/bubbles'
import { generatePanelImage, placePanelArt, pageHasArt, sleepCancellable } from '@/lib/editor/panelArt'

// `position` is one of nine placement zones the storyboard picks so dialogue
// lands in the panel's negative space instead of over the art (see BubblePos).
interface StoryBubble { kind: BubbleKind; text: string; position?: string }
export interface StoryPanel { scene: string; palette?: string; motion?: string; bubbles: StoryBubble[] }

// Storyboard placement zone → fractional center on the page (0–1).
const BUBBLE_POS: Record<string, { x: number; y: number }> = {
  'top-left': { x: 0.3, y: 0.18 },   'top-center': { x: 0.5, y: 0.18 },   'top-right': { x: 0.7, y: 0.18 },
  'mid-left': { x: 0.3, y: 0.5 },    center: { x: 0.5, y: 0.5 },          'mid-right': { x: 0.7, y: 0.5 },
  'bottom-left': { x: 0.3, y: 0.82 },'bottom-center': { x: 0.5, y: 0.82 },'bottom-right': { x: 0.7, y: 0.82 },
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const TARGET_PANELS = 20
// Paint ONE panel at a time. Pollinations' keyless/anonymous tier allows only
// ~1 image request every 15s, so firing 2 concurrently (or even 1.2s apart)
// guarantees a 429 on the second → blank panels. Each generation of a long,
// unique Color-Bible prompt takes ~45–60s, so serial requests are naturally
// spaced well past the 15s window → no 429 storms. Set POLLINATIONS_TOKEN
// (server env) for a higher tier if you want to raise this back up.
const ART_CONCURRENCY = 1
const START_STAGGER_MS = 1200

async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++
        await fn(items[i], i)
      }
    }),
  )
}

export type WorkflowState = 'idle' | 'generating_script' | 'review_script' | 'generating_template' | 'review_template' | 'painting' | 'done' | 'error'

export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle')
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  
  const [storyboardData, setStoryboardData] = useState<{ character: string; style: string; panels: StoryPanel[] } | null>(null)
  const [builtPanelsData, setBuiltPanelsData] = useState<{ pageId: string; prompt: string }[]>([])
  
  // Use a ref to immediately signal cancellation to any running async loops
  const cancelRef = useRef(false)

  const reset = useCallback(() => {
    cancelRef.current = true
    setWorkflowState('idle')
    setProgress(null)
    setResult(null)
    setStoryboardData(null)
    setBuiltPanelsData([])
  }, [])

  const generateScript = useCallback(async (script: string) => {
    if (workflowState !== 'idle' && workflowState !== 'error' && workflowState !== 'done') return
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
    setWorkflowState('generating_script')
    setResult(null)
    setStoryboardData(null)
    
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
      
      const sdata = (await sres.json()) as { character?: string; style?: string; panels?: StoryPanel[]; error?: string }
      if (!sres.ok) throw new Error(sdata.error ?? 'Planning failed')
      const panels = sdata.panels ?? []
      if (panels.length === 0) throw new Error('No panels were produced')

      setStoryboardData({ character: sdata.character || '', style: sdata.style || '', panels })
      setWorkflowState('review_script')
      setProgress(null)
    } catch (err) {
      if (cancelRef.current) return
      const msg = err instanceof Error ? err.message : 'Workflow failed'
      setResult(`Failed: ${msg}`)
      toast.error(msg)
      setWorkflowState('error')
      setProgress(null)
    }
  }, [workflowState])

  const approveScript = useCallback(async () => {
    if (workflowState !== 'review_script' || !storyboardData) return
    cancelRef.current = false
    setWorkflowState('generating_template')
    setResult(null)
    
    try {
      const store = useEditorStore.getState()
      store.loadProject(null)
      const { character, style, panels } = storyboardData
      // Prepended to every panel so the whole chapter shares one locked look/grade.
      const stylePrefix = style ? `${style}. ` : ''
      const characterPrefix = character ? `${character}. ` : ''
      
      setProgress(`Storyboard Artist is laying out ${panels.length} panels…`)
      const built: { pageId: string; prompt: string }[] = []
      
      for (const panel of panels) {
        if (cancelRef.current) return
        // style (locked grade) → character (locked look) → scene → 60/30/10 palette
        const palette = panel.palette ? `. Color: ${panel.palette}` : ''
        const artPrompt = stylePrefix + characterPrefix + panel.scene + palette
        // Stash the prompt on the page so a blank panel can be re-painted later
        // WITHOUT re-running the storyboard from scratch (see paintCanvas). Each
        // page starts 'ready' so the page-by-page gate makes only the first one
        // workable and unlocks the rest as they're approved.
        const pageId = store.addPage({ artPrompt, status: 'ready' }, 'webtoon')
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
        built.push({ pageId, prompt: artPrompt })
      }

      useEditorStore.getState().clearSelection()
      useEditorStore.getState().mergeEpisode()
      useEditorStore.getState().fitWidth()
      
      if (cancelRef.current) return
      setBuiltPanelsData(built)
      setWorkflowState('review_template')
      setProgress(null)
    } catch (err) {
      if (cancelRef.current) return
      const msg = err instanceof Error ? err.message : 'Workflow failed'
      setResult(`Failed: ${msg}`)
      toast.error(msg)
      setWorkflowState('error')
      setProgress(null)
    }
  }, [workflowState, storyboardData])

  // Shared painter: generate a manhwa background per panel in `built` and drop it
  // behind the bubbles. Used both for the first paint (approveTemplate) and for
  // filling in blanks on the current canvas (paintCanvas).
  const paintBuilt = useCallback(async (built: { pageId: string; prompt: string }[]) => {
    cancelRef.current = false
    setWorkflowState('painting')
    setResult(null)

    try {
      setProgress(`Painting ${built.length} panel${built.length === 1 ? '' : 's'}… (this takes a few minutes)`)
      let painted = 0
      let failed = 0
      let rateLimited = false
      let firstFail = ''

      await pool(built, ART_CONCURRENCY, async ({ pageId, prompt }, i) => {
        if (cancelRef.current) return
        // Stagger request starts a little so the two workers don't fire together.
        if (i > 0) await sleepCancellable(START_STAGGER_MS, () => cancelRef.current)
        if (cancelRef.current) return
        // Reflect batch progress on the page itself so the Page Overview shows
        // it painting live and marks it done (unlocking the next in the gate).
        useEditorStore.getState().setPageStatus(pageId, 'generating')
        // generatePanelImage handles retry + 429 backoff internally.
        const res = await generatePanelImage(prompt, () => cancelRef.current)
        if (cancelRef.current) return

        if (res.ok) {
          try {
            const url = await uploadCanvasImage(`data:${res.mime};base64,${res.base64}`, `panel-${pageId}`)
            if (placePanelArt(pageId, url)) {
              painted += 1
              useEditorStore.getState().setPageStatus(pageId, 'completed')
            } else {
              failed += 1
              useEditorStore.getState().setPageStatus(pageId, 'ready')
            }
          } catch (e) {
            if (cancelRef.current) return
            if (!firstFail) firstFail = e instanceof Error ? `upload failed — ${e.message}` : 'upload failed'
            failed += 1
            useEditorStore.getState().setPageStatus(pageId, 'ready')
          }
        } else {
          if (res.rateLimited) rateLimited = true
          if (!firstFail) firstFail = res.error
          failed += 1
          useEditorStore.getState().setPageStatus(pageId, 'ready')
        }
        setProgress(`Painting panels… ${painted + failed}/${built.length} · ${painted} done`)
      })

      if (cancelRef.current) return
      useEditorStore.getState().clearSelection()

      if (painted === 0) {
        const why = rateLimited
          ? 'the image limit was hit — wait ~2 min or restart the dev server, then try again'
          : firstFail || 'the image service returned no image'
        setResult(`0/${built.length} panels got art — ${why}. Use “Paint remaining panels” to retry.`)
        toast.error(`No art: ${why}`, { duration: 11000 })
      } else if (failed > 0) {
        setResult(
          `Painted ${painted}/${built.length}. ${failed} still blank${firstFail ? ` (first: ${firstFail})` : ''}. Use “Paint remaining panels” to fill them.`,
        )
        toast.success(`Painted ${painted} of ${built.length}. Use “Paint remaining panels” to fill the rest.`, { duration: 8000 })
      } else {
        setResult(`Done — painted all ${painted} panels.`)
        toast.success('Chapter ready — edit any bubble or panel on top of the art.')
      }
      setWorkflowState('done')
    } catch (err) {
      if (cancelRef.current) return
      const msg = err instanceof Error ? err.message : 'Painting failed'
      setResult(`Failed: ${msg}`)
      toast.error(msg)
      setWorkflowState('error')
    } finally {
      if (!cancelRef.current) setProgress(null)
    }
  }, [])

  const approveTemplate = useCallback(async () => {
    if (workflowState !== 'review_template' || builtPanelsData.length === 0) return
    await paintBuilt(builtPanelsData)
  }, [workflowState, builtPanelsData, paintBuilt])

  // "Paint remaining panels" — paints art onto the agent-built pages on the
  // CURRENT canvas that still have no background (blank/gray), reading each
  // panel's prompt back off its page. Lets the user continue from the existing
  // panels — retrying blanks or ones that timed out — without clearing the
  // canvas or re-running the storyboard from scratch.
  const paintCanvas = useCallback(async () => {
    if (workflowState === 'painting' || workflowState === 'generating_script' || workflowState === 'generating_template') return
    const { pages, timelineOrder } = useEditorStore.getState()
    const built = timelineOrder
      .map((pid) => pages.find((p) => p.id === pid))
      .filter((p): p is Page => Boolean(p))
      .filter((p) => p.artPrompt && !pageHasArt(p))
      .map((p) => ({ pageId: p.id, prompt: p.artPrompt as string }))
    if (built.length === 0) {
      toast('Every panel already has art — nothing to paint.')
      return
    }
    await paintBuilt(built)
  }, [workflowState, paintBuilt])

  // How many agent-built panels on the current canvas are still blank — drives
  // the "Paint remaining panels" button.
  const blankPanelCount = useEditorStore(
    (s) => s.pages.filter((p) => p.artPrompt && !pageHasArt(p)).length,
  )

  return {
    workflowState,
    storyboardData,
    builtPanelsData,
    progress,
    result,
    blankPanelCount,
    generateScript,
    approveScript,
    approveTemplate,
    paintCanvas,
    reset,
  }
}
