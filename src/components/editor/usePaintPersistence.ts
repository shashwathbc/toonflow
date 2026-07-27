'use client'

import { useEffect } from 'react'
import { useEditorStore, type PaintElement } from '@/store/useEditorStore'
import { uploadCanvasImage } from '@/lib/editor/persistence'
import { markPaintSrc } from '@/lib/editor/brush/bitmaps'

/**
 * Persists paint layers to cloud Storage so painted work survives a reload.
 *
 * A stroke commits its bitmap as an inline `data:` URL (instant, offline-safe,
 * undoable). This hook debounces, then uploads any layer still holding a data
 * URL to Firebase Storage and swaps `src` to the returned download URL — which
 * is what `serializeProject` persists (base64 is stripped so the 1 MB Firestore
 * doc limit is never hit). On the next open, PaintNode reconciles the canvas
 * from that URL.
 *
 * Debouncing coalesces a flurry of strokes into ONE upload of the final bitmap,
 * and the in-flight guard + "src unchanged" recheck avoid clobbering a stroke
 * that lands mid-upload. With no upload context bound (dev / unauthenticated),
 * uploadCanvasImage returns the data URL unchanged and nothing is committed.
 */
export function usePaintPersistence() {
  useEffect(() => {
    const inflight = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = async () => {
      const ctx = useEditorStore.getState().assetCtx
      if (!ctx) return // no Storage target — keep the inline bitmap as-is
      for (const page of useEditorStore.getState().pages) {
        for (const el of page.elements) {
          if (el.type !== 'paint') continue
          const src = (el as PaintElement).src
          if (!src.startsWith('data:') || inflight.has(el.id)) continue
          inflight.add(el.id)
          try {
            const url = await uploadCanvasImage(src, `paint-${el.id}`)
            if (url === src) continue // fallback path returned the data URL
            // Only commit if this layer still shows the exact bitmap we uploaded
            // (a newer stroke would have replaced src — leave that for next pass).
            const cur = useEditorStore
              .getState()
              .pages.find((p) => p.id === page.id)
              ?.elements.find((e) => e.id === el.id) as PaintElement | undefined
            if (cur && cur.src === src) {
              markPaintSrc(el.id, url) // canvas already holds these pixels
              useEditorStore.getState().updateElement(page.id, el.id, { src: url }, false)
            }
          } catch {
            /* transient upload failure — retried on the next change */
          } finally {
            inflight.delete(el.id)
          }
        }
      }
    }

    const unsub = useEditorStore.subscribe(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 1500)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [])
}
