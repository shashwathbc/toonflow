'use client'

import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { useEditorStore } from '@/store/useEditorStore'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { getWebtoonById } from '@/lib/firebase/firestore'
import type { BubbleKind } from '@/lib/editor/bubbles'

interface StoryBubble { kind: BubbleKind; text: string }
interface StoryPanel { scene: string; bubbles: StoryBubble[] }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// How many panels/pages a "chapter" run aims for, and how many backgrounds to
// paint at once (small, to stay gentle on the free upstream image service).
const TARGET_PANELS = 20
const ART_CONCURRENCY = 2

// Locks the generated art to the long-scroll manhwa look (Magic Emperor / Fated
// Villain style). Appended to every panel's scene prompt. Tuned against the live
// image service for the cleanest published-webtoon feel it can produce.
const MANHWA_STYLE =
  ', korean manhwa webtoon panel, official webtoon art style, clean sharp digital lineart,' +
  ' cel shading, screentone, vibrant colors, cinematic dramatic lighting,' +
  ' dynamic vertical composition, professional studio quality, highly detailed'

/** Run `fn` over `items` with at most `n` in flight at once. */
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

/**
 * "Run agent workflow" — turns a chapter brief/script into a fresh long-vertical
 * webtoon:
 *  1. Story Director → storyboard (up to ~20 panels), using the series
 *     title/premise as context.
 *  2. Storyboard Artist → a FRESH canvas: one webtoon page per panel with the
 *     dialogue laid out as editable speech bubbles, then stacked into one
 *     continuous vertical strip (the template is ready in seconds).
 *  3. Environment/Color Artist → a manhwa-style background painted for each
 *     panel and dropped BEHIND its bubbles, so everything stays editable on top.
 *
 * Starting fresh replaces the current canvas, so a confirm guards it.
 */
export function useAgentWorkflow() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  // Sticky outcome of the last run (why art did / didn't paint), shown in the panel.
  const [result, setResult] = useState<string | null>(null)

  const run = useCallback(
    async (script: string) => {
      if (running) return
      const trimmed = script.trim()
      if (trimmed.length < 4) {
        toast.error('Type a chapter brief or paste your script first')
        return
      }
      // Fresh start replaces whatever is on the canvas — confirm if non-empty.
      if (
        useEditorStore.getState().pages.length > 0 &&
        typeof window !== 'undefined' &&
        !window.confirm('Start a fresh chapter? This clears everything currently on the canvas.')
      ) {
        return
      }

      setRunning(true)
      setResult(null)
      try {
        // Series context so a short brief ("make chapter 1") uses this webtoon.
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
          } catch {
            /* context is best-effort */
          }
        }

        // ── 1. storyboard ───────────────────────────────────────────────
        setProgress('Story Director is planning the chapter…')
        const sres = await fetch('/api/ai/storyboard', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ script: trimmed, title, synopsis, panels: TARGET_PANELS }),
        })
        const sdata = (await sres.json()) as { character?: string; panels?: StoryPanel[]; error?: string }
        if (!sres.ok) throw new Error(sdata.error ?? 'Planning failed')
        const panels = sdata.panels ?? []
        if (panels.length === 0) throw new Error('No panels were produced')
        // Prepended to every panel's art prompt so the character stays consistent.
        const characterPrefix = sdata.character ? `${sdata.character}. ` : ''

        // ── 2. fresh template: page + dialogue bubbles per panel ─────────
        const store = useEditorStore.getState()
        store.loadProject(null) // fresh canvas
        setProgress(`Storyboard Artist is laying out ${panels.length} panels…`)
        const built: { pageId: string; prompt: string }[] = []
        for (const panel of panels) {
          const pageId = store.addPage({}, 'webtoon')
          const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
          if (!page) continue
          const n = panel.bubbles.length || 1
          panel.bubbles.forEach((b, idx) => {
            const cy = page.height * (0.16 + (0.68 * (idx + 0.5)) / n)
            const id = store.addBubble(pageId, b.kind, page.width / 2, cy)
            if (id) useEditorStore.getState().updateElement(pageId, id, { text: b.text }, false)
          })
          built.push({ pageId, prompt: characterPrefix + panel.scene })
        }

        // Stack into one long vertical scroll immediately (template is usable now).
        useEditorStore.getState().clearSelection()
        useEditorStore.getState().mergeEpisode()
        useEditorStore.getState().fitWidth()

        // ── 3. art: a manhwa background per panel, behind the bubbles ────
        setProgress(`Painting ${built.length} panels… (this takes a few minutes)`)
        let painted = 0
        let failed = 0
        let rateLimited = false
        let firstFail = '' // first concrete failure reason, surfaced to the user

        // One panel: generate (1 retry for transient hiccups) with a hard client
        // timeout so a hung request can't stall the whole run. Returns the image
        // or null; a 429 isn't retried (the whole run is throttled).
        const generatePanel = async (prompt: string): Promise<{ base64: string; mime: string } | null> => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 75_000)
            try {
              const ires = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({ action: 'generate', prompt: prompt + MANHWA_STYLE, imageType: 'cover' }),
                signal: ctrl.signal,
              })
              const idata = (await ires.json()) as { imageBase64?: string; imageMime?: string; error?: string }
              if (ires.ok && idata.imageBase64) {
                return { base64: idata.imageBase64, mime: idata.imageMime ?? 'image/jpeg' }
              }
              if (!firstFail) firstFail = `HTTP ${ires.status}${idata.error ? ` — ${idata.error}` : ''}`
              console.warn('[agent workflow] image gen failed', ires.status, idata.error)
              if (ires.status === 429) {
                rateLimited = true
                return null
              }
            } catch (e) {
              if (!firstFail) firstFail = e instanceof Error ? `${e.name}: ${e.message}` : 'network error'
              console.warn('[agent workflow] image gen error', e)
            } finally {
              clearTimeout(timer)
            }
          }
          return null
        }

        await pool(built, ART_CONCURRENCY, async ({ pageId, prompt }, i) => {
          const img = await generatePanel(prompt)
          if (img) {
            try {
              const dataUrl = `data:${img.mime};base64,${img.base64}`
              const url = await uploadCanvasImage(dataUrl, `panel-${pageId}`)
              const page = useEditorStore.getState().pages.find((p) => p.id === pageId)
              if (page) {
                const imgId = useEditorStore.getState().addElement(pageId, {
                  type: 'image',
                  src: url,
                  x: 0,
                  y: 0,
                  width: page.width,
                  height: page.height,
                  name: `Panel ${i + 1} art`,
                  isLocked: true,
                })
                useEditorStore.getState().moveZ(pageId, imgId, 'back') // behind the bubbles
                painted += 1
              }
            } catch (e) {
              if (!firstFail) firstFail = e instanceof Error ? `upload failed — ${e.message}` : 'upload failed'
              console.error('[agent workflow] place/upload failed', e)
              failed += 1
            }
          } else {
            failed += 1
          }
          setProgress(`Painting panels… ${painted + failed}/${built.length} · ${painted} done`)
        })

        useEditorStore.getState().clearSelection()

        // ── 4. tell the user exactly what happened (sticky, not just a toast) ──
        if (painted === 0) {
          const why = rateLimited
            ? 'the image limit was hit — wait ~2 min or restart the dev server, then Run again'
            : firstFail || 'the image service returned no image'
          setResult(`Template built, but 0/${built.length} panels got art — ${why}.`)
          toast.error(`No art: ${why}`, { duration: 11000 })
        } else if (failed > 0) {
          setResult(
            `Painted ${painted}/${built.length}. ${failed} failed${firstFail ? ` (first: ${firstFail})` : ''}. Run again later to fill the rest.`,
          )
          toast.success(`Chapter ready — painted ${painted} of ${built.length}. Run again to fill the rest.`, { duration: 8000 })
        } else {
          setResult(`Done — painted all ${painted} panels.`)
          toast.success('Fresh chapter ready — edit any bubble or panel on top of the art.')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Workflow failed'
        setResult(`Failed: ${msg}`)
        toast.error(msg)
      } finally {
        setRunning(false)
        setProgress(null)
      }
    },
    [running],
  )

  return { run, running, progress, result }
}
