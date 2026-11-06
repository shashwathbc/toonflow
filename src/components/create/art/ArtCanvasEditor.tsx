'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Cloud,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Lock,
  LockOpen,
  Redo2,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useArtEditorStore } from '@/store/useArtEditorStore'
import { loadArtDocument, saveArtDocument, updateArtwork } from '@/lib/firebase/art'
import { uploadArtworkRender } from '@/lib/firebase/storage'
import { filterCss, loadImage, canvasToBlob, removeFlatBackground } from '@/lib/art/raster'
import { validateArtworkFile } from '@/lib/art/validation'
import { cn } from '@/lib/utils/cn'
import type { ArtFilterId, ArtLayer, Artwork } from '@/types/art'

const AUTOSAVE_MS = 2000

const FILTERS: { id: ArtFilterId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'anime', label: 'Anime' },
  { id: 'grayscale', label: 'Mono' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'saturate', label: 'Vivid' },
  { id: 'contrast', label: 'Punch' },
  { id: 'invert', label: 'Invert' },
  { id: 'blur', label: 'Blur' },
]

/**
 * Layered artwork editor.
 *
 * Layers are DOM elements over a scaled stage, which makes dragging, resizing
 * and live filters cheap and accessible; export re-draws the same model onto a
 * full-resolution <canvas>. So what you see is what gets uploaded, at the real
 * pixel size rather than the on-screen one.
 */
export default function ArtCanvasEditor({ artwork }: { artwork: Artwork }) {
  const router = useRouter()
  const { firebaseUser } = useAuth()

  const load = useArtEditorStore((s) => s.load)
  const layers = useArtEditorStore((s) => s.layers)
  const width = useArtEditorStore((s) => s.width)
  const height = useArtEditorStore((s) => s.height)
  const background = useArtEditorStore((s) => s.background)
  const selectedLayerId = useArtEditorStore((s) => s.selectedLayerId)
  const dirty = useArtEditorStore((s) => s.dirty)
  const addLayer = useArtEditorStore((s) => s.addLayer)
  const updateLayer = useArtEditorStore((s) => s.updateLayer)
  const removeLayer = useArtEditorStore((s) => s.removeLayer)
  const duplicateLayer = useArtEditorStore((s) => s.duplicateLayer)
  const reorderLayer = useArtEditorStore((s) => s.reorderLayer)
  const select = useArtEditorStore((s) => s.select)
  const pushHistory = useArtEditorStore((s) => s.pushHistory)
  const undo = useArtEditorStore((s) => s.undo)
  const redo = useArtEditorStore((s) => s.redo)
  const setBackground = useArtEditorStore((s) => s.setBackground)
  const markClean = useArtEditorStore((s) => s.markClean)
  const toDocument = useArtEditorStore((s) => s.toDocument)

  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageScale, setStageScale] = useState(0.3)

  const selected = layers.find((layer) => layer.id === selectedLayerId) ?? null

  // ── Load ────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    void loadArtDocument(artwork.id).then(async (document) => {
      if (!active) return
      if (document) {
        load(artwork.id, document)
      } else {
        // First open of an uploaded piece: seed the canvas with the upload as a
        // full-bleed base layer, so the editor never starts blank on top of an
        // image the creator can already see in the library.
        load(artwork.id, null)
        if (artwork.imageURL) {
          useArtEditorStore.setState({
            width: artwork.width || 2048,
            height: artwork.height || 2048,
            layers: [
              {
                id: 'base',
                kind: 'image',
                name: 'Artwork',
                x: 0,
                y: 0,
                width: artwork.width || 2048,
                height: artwork.height || 2048,
                rotation: 0,
                opacity: 1,
                visible: true,
                locked: false,
                src: artwork.imageURL,
                filter: 'none',
              },
            ],
          })
        }
      }
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [artwork.id, artwork.imageURL, artwork.width, artwork.height, load])

  // Fit the stage to its container, and keep it fitted on resize.
  useEffect(() => {
    const element = stageRef.current?.parentElement
    if (!element) return
    const fit = () => {
      const padding = 48
      const scale = Math.min(
        (element.clientWidth - padding) / width,
        (element.clientHeight - padding) / height,
        1,
      )
      setStageScale(Math.max(0.05, scale))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height, ready])

  // ── Autosave ────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const persist = useCallback(async () => {
    setSaving(true)
    try {
      await saveArtDocument(artwork.id, toDocument())
      markClean()
    } catch (err) {
      console.error('[ArtCanvasEditor] save failed', err)
      toast.error('Could not save. Your work is still here — check your connection.')
    } finally {
      setSaving(false)
    }
  }, [artwork.id, toDocument, markClean])

  useEffect(() => {
    if (!ready || !dirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void persist(), AUTOSAVE_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [layers, background, dirty, ready, persist])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (useArtEditorStore.getState().dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Keyboard ────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persist()
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLayerId) {
        event.preventDefault()
        removeLayer(selectedLayerId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, persist, selectedLayerId, removeLayer])

  // ── Layer drag ──────────────────────────────────────────
  const drag = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  )
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = drag.current
      if (!state) return
      updateLayer(state.id, {
        x: state.originX + (event.clientX - state.startX) / stageScale,
        y: state.originY + (event.clientY - state.startY) / stageScale,
      })
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [stageScale, updateLayer])

  // ── Tools ───────────────────────────────────────────────
  const addImageLayer = useCallback(
    async (file: File) => {
      const check = await validateArtworkFile(file)
      if (!check.ok) {
        toast.error(check.message ?? 'That file could not be used')
        return
      }
      if (check.detectedMime === 'image/svg+xml') {
        toast.error('Please export a PNG or WebP for now')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const src = String(reader.result)
        void loadImage(src).then(({ width: w, height: h }) => {
          const scale = Math.min(width / w, height / h, 1)
          addLayer({
            kind: 'image',
            name: file.name.slice(0, 40),
            x: (width - w * scale) / 2,
            y: (height - h * scale) / 2,
            width: w * scale,
            height: h * scale,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            src,
            filter: 'none',
          })
        })
      }
      reader.readAsDataURL(file)
    },
    [addLayer, width, height],
  )

  const addTextLayer = () =>
    addLayer({
      kind: 'text',
      name: 'Text',
      x: width * 0.2,
      y: height * 0.45,
      width: width * 0.6,
      height: 160,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: 'Your text',
      fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      fontSize: 120,
      fill: '#FFFFFF',
      align: 'center',
    })

  const addShapeLayer = (shape: 'rect' | 'ellipse' | 'triangle') =>
    addLayer({
      kind: 'shape',
      name: shape,
      x: width * 0.3,
      y: height * 0.3,
      width: width * 0.4,
      height: height * 0.4,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      shape,
      fill: '#A78BFA',
      stroke: '#FFFFFF',
      strokeWidth: 0,
    })

  const handleRemoveBackground = useCallback(async () => {
    if (!selected || selected.kind !== 'image' || !selected.src) {
      toast.error('Select an image layer first')
      return
    }
    setBusy('background')
    try {
      const result = await removeFlatBackground(selected.src)
      pushHistory()
      updateLayer(selected.id, { src: result })
      toast.success('Background removed')
    } catch (err) {
      console.error('[ArtCanvasEditor] background removal', err)
      toast.error('Could not remove the background from that image')
    } finally {
      setBusy(null)
    }
  }, [selected, pushHistory, updateLayer])

  /** Draw the layer model onto a full-resolution canvas. */
  const renderToCanvas = useCallback(async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')

    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)
    }

    for (const layer of layers) {
      if (!layer.visible) continue
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.filter = filterCss(layer.filter)
      ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2)
      ctx.rotate((layer.rotation * Math.PI) / 180)
      ctx.translate(-layer.width / 2, -layer.height / 2)

      if (layer.kind === 'image' && layer.src) {
        const { image } = await loadImage(layer.src)
        ctx.drawImage(image, 0, 0, layer.width, layer.height)
      } else if (layer.kind === 'text' && layer.text) {
        ctx.fillStyle = layer.fill ?? '#FFFFFF'
        ctx.font = `800 ${layer.fontSize ?? 96}px Inter, system-ui, sans-serif`
        ctx.textBaseline = 'top'
        ctx.textAlign = layer.align ?? 'center'
        const originX = layer.align === 'left' ? 0 : layer.align === 'right' ? layer.width : layer.width / 2
        // Wrap manually — canvas has no text layout engine.
        const words = layer.text.split(/\s+/)
        const lineHeight = (layer.fontSize ?? 96) * 1.15
        let line = ''
        let offsetY = 0
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word
          if (ctx.measureText(candidate).width > layer.width && line) {
            ctx.fillText(line, originX, offsetY)
            line = word
            offsetY += lineHeight
          } else {
            line = candidate
          }
        }
        if (line) ctx.fillText(line, originX, offsetY)
      } else if (layer.kind === 'shape') {
        ctx.fillStyle = layer.fill ?? '#FFFFFF'
        ctx.strokeStyle = layer.stroke ?? 'transparent'
        ctx.lineWidth = layer.strokeWidth ?? 0
        if (layer.shape === 'ellipse') {
          ctx.beginPath()
          ctx.ellipse(layer.width / 2, layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          if (layer.strokeWidth) ctx.stroke()
        } else if (layer.shape === 'triangle') {
          ctx.beginPath()
          ctx.moveTo(layer.width / 2, 0)
          ctx.lineTo(layer.width, layer.height)
          ctx.lineTo(0, layer.height)
          ctx.closePath()
          ctx.fill()
          if (layer.strokeWidth) ctx.stroke()
        } else {
          ctx.fillRect(0, 0, layer.width, layer.height)
          if (layer.strokeWidth) ctx.strokeRect(0, 0, layer.width, layer.height)
        }
      }
      ctx.restore()
    }
    return canvas
  }, [layers, width, height, background])

  const handleExport = useCallback(async () => {
    if (!firebaseUser) return
    setExporting(true)
    try {
      const canvas = await renderToCanvas()
      const blob = await canvasToBlob(canvas, 'image/png')
      const url = await uploadArtworkRender(firebaseUser.uid, artwork.id, blob, 'full')
      await updateArtwork(artwork.id, {
        imageURL: url,
        thumbnailURL: url,
        width,
        height,
        sizeBytes: blob.size,
        mimeType: 'image/png',
      })
      await persist()
      toast.success('Artwork saved and rendered')
      router.push(`/create/art/publish?artworkId=${artwork.id}`)
    } catch (err) {
      console.error('[ArtCanvasEditor] export failed', err)
      toast.error('Could not render that artwork. Check that every image layer loaded.')
    } finally {
      setExporting(false)
    }
  }, [firebaseUser, renderToCanvas, artwork.id, width, height, persist, router])

  // The layer DOM, shared by both surfaces. Extracted so the flat canvas and
  // the product stage render the IDENTICAL nodes — the design on the shirt is
  // the live canvas, not a preview that could drift from it.
  const layerSurface = (
    <>
              {layers.map((layer) => {
      if (!layer.visible) return null
      const isSelected = layer.id === selectedLayerId
      return (
        <div
          key={layer.id}
          role="button"
          tabIndex={0}
          aria-label={`${layer.name} layer${isSelected ? ', selected' : ''}`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              select(layer.id)
            }
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
            select(layer.id)
            if (layer.locked) return
            pushHistory()
            drag.current = {
              id: layer.id,
              startX: event.clientX,
              startY: event.clientY,
              originX: layer.x,
              originY: layer.y,
            }
          }}
          className={cn(
            'absolute',
            isSelected && 'outline outline-2 outline-offset-2 outline-studio-art',
            layer.locked ? 'cursor-not-allowed' : 'cursor-move',
          )}
          style={{
            left: layer.x,
            top: layer.y,
            width: layer.width,
            height: layer.height,
            opacity: layer.opacity,
            transform: `rotate(${layer.rotation}deg)`,
            filter: filterCss(layer.filter),
          }}
        >
          {layer.kind === 'image' && layer.src && (
            // Deliberately a plain <img>: the source is often an
            // in-memory data URL, and next/image can't optimise those.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layer.src}
              alt=""
              draggable={false}
              className="h-full w-full select-none object-contain"
            />
          )}
          {layer.kind === 'text' && (
            <span
              className="block h-full w-full break-words"
              style={{
                fontFamily: layer.fontFamily,
                fontSize: layer.fontSize,
                color: layer.fill,
                textAlign: layer.align,
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              {layer.text}
            </span>
          )}
          {layer.kind === 'shape' && (
            <span
              className="block h-full w-full"
              style={{
                backgroundColor: layer.shape === 'triangle' ? undefined : layer.fill,
                borderRadius: layer.shape === 'ellipse' ? '50%' : 0,
                clipPath: layer.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
                background: layer.shape === 'triangle' ? layer.fill : undefined,
                border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
              }}
            />
          )}
        </div>
      )
              })}
    </>
  )

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 size={26} className="animate-spin text-text-muted motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Loading editor…</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-bg-border bg-bg-card px-2 sm:px-3">
        <Link
          href="/create/art"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden text-sm sm:inline">Art Studio</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-text">{artwork.title}</h1>

        <button
          type="button"
          onClick={undo}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={redo}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Redo"
        >
          <Redo2 size={16} aria-hidden="true" />
        </button>

        <p className="hidden items-center gap-1.5 text-[11px] text-text-muted md:flex" role="status" aria-live="polite">
          {saving ? (
            <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : dirty ? (
            <Cloud size={12} aria-hidden="true" />
          ) : (
            <Check size={12} aria-hidden="true" />
          )}
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </p>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-studio-art px-3 py-1.5 text-xs font-bold text-bg transition-colors hover:bg-studio-art/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-art focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
        >
          {exporting ? 'Rendering…' : 'Render & publish'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Tools */}
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-bg-border bg-bg-card p-2 lg:w-16 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
          aria-label="Drawing tools"
        >
          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-within:ring-2 focus-within:ring-accent">
            <ImagePlus size={17} aria-hidden="true" />
            Image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void addImageLayer(file)
              }}
            />
          </label>
          <button
            type="button"
            onClick={addTextLayer}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Type size={17} aria-hidden="true" />
            Text
          </button>
          <button
            type="button"
            onClick={() => addShapeLayer('rect')}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Square size={17} aria-hidden="true" />
            Rect
          </button>
          <button
            type="button"
            onClick={() => addShapeLayer('ellipse')}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Circle size={17} aria-hidden="true" />
            Circle
          </button>
          <button
            type="button"
            onClick={() => addShapeLayer('triangle')}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Triangle size={17} aria-hidden="true" />
            Tri
          </button>
          <button
            type="button"
            onClick={() => void handleRemoveBackground()}
            disabled={busy === 'background' || selected?.kind !== 'image'}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg p-2 text-[9px] font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Remove a flat background from the selected image"
          >
            {busy === 'background' ? (
              <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Eraser size={17} aria-hidden="true" />
            )}
            Cutout
          </button>
        </nav>

        {/* Product controls — what this design is going ON. */}
        <ProductBar
          surface={surface}
          onSurfaceMode={setSurfaceMode}
          onProductType={setProductType}
          onColor={setProductColor}
          onPlacement={setPlacement}
          onTogglePrintArea={togglePrintArea}
        />

        {/* Stage */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 p-4">
          {isProductSurface ? (
            <ProductStage
              productType={surface.productType}
              placement={surface.placement}
              color={stageColor}
              showPrintArea={surface.showPrintArea}
              designWidth={width}
              designHeight={height}
            >
              {layerSurface}
            </ProductStage>
          ) : (
          <div
            ref={stageRef}
            className="relative origin-center shadow-2xl"
            style={{
              width,
              height,
              transform: `scale(${stageScale})`,
              // A checkerboard reads as "transparent" — essential when the whole
              // point is producing transparent PNG designs.
              backgroundColor: background ?? undefined,
              backgroundImage: background
                ? undefined
                : 'linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)',
              backgroundSize: '48px 48px',
              backgroundPosition: '0 0, 0 24px, 24px -24px, -24px 0',
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) select(null)
            }}
          >
            {layerSurface}
          </div>
          )}
        </div>

        {/* Layers + properties */}
        <aside
          className="flex max-h-64 shrink-0 flex-col overflow-y-auto border-t border-bg-border bg-bg-card lg:max-h-none lg:w-72 lg:border-l lg:border-t-0"
          aria-label="Layers and properties"
        >
          <section className="border-b border-bg-border p-3">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Layers</h2>
            {layers.length === 0 ? (
              <p className="text-xs text-text-muted">Nothing here yet. Add an image, text or a shape.</p>
            ) : (
              <ul className="space-y-1" role="list">
                {[...layers].reverse().map((layer) => (
                  <li key={layer.id}>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
                        layer.id === selectedLayerId
                          ? 'border-studio-art/40 bg-studio-art/10'
                          : 'border-bg-border',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => select(layer.id)}
                        className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {layer.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                        aria-pressed={!layer.visible}
                      >
                        {layer.visible ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                        aria-pressed={layer.locked}
                      >
                        {layer.locked ? <Lock size={12} aria-hidden="true" /> : <LockOpen size={12} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderLayer(layer.id, 1)}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`Move ${layer.name} up`}
                      >
                        <ArrowUp size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderLayer(layer.id, -1)}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`Move ${layer.name} down`}
                      >
                        <ArrowDown size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateLayer(layer.id)}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`Duplicate ${layer.name}`}
                      >
                        <Copy size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLayer(layer.id)}
                        className="rounded p-0.5 text-text-muted transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                        aria-label={`Delete ${layer.name}`}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selected && (
            <section className="border-b border-bg-border p-3">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Properties
              </h2>
              <div className="space-y-2.5">
                {selected.kind === 'text' && (
                  <>
                    <label htmlFor="layer-text" className="block text-[11px] text-text-secondary">
                      Text
                    </label>
                    <textarea
                      id="layer-text"
                      value={selected.text ?? ''}
                      onChange={(event) => updateLayer(selected.id, { text: event.target.value.slice(0, 500) })}
                      rows={2}
                      className="input-base w-full resize-none text-xs"
                    />
                    <LayerNumber
                      id="layer-fontsize"
                      label="Size"
                      value={selected.fontSize ?? 96}
                      min={8}
                      max={400}
                      onChange={(fontSize) => updateLayer(selected.id, { fontSize })}
                    />
                  </>
                )}

                {(selected.kind === 'text' || selected.kind === 'shape') && (
                  <div className="grid grid-cols-[76px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Colour</span>
                    <input
                      type="color"
                      value={selected.fill ?? '#FFFFFF'}
                      onChange={(event) => updateLayer(selected.id, { fill: event.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-bg-border bg-bg-elevated"
                      aria-label="Layer colour"
                    />
                  </div>
                )}

                <LayerNumber
                  id="layer-width"
                  label="Width"
                  value={Math.round(selected.width)}
                  min={8}
                  max={width * 2}
                  onChange={(value) => updateLayer(selected.id, { width: value })}
                />
                <LayerNumber
                  id="layer-height"
                  label="Height"
                  value={Math.round(selected.height)}
                  min={8}
                  max={height * 2}
                  onChange={(value) => updateLayer(selected.id, { height: value })}
                />
                <LayerNumber
                  id="layer-rotation"
                  label="Rotate"
                  value={selected.rotation}
                  min={-180}
                  max={180}
                  onChange={(rotation) => updateLayer(selected.id, { rotation })}
                />
                <LayerNumber
                  id="layer-opacity"
                  label="Opacity"
                  value={selected.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(opacity) => updateLayer(selected.id, { opacity })}
                />

                {selected.kind === 'image' && (
                  <div>
                    <span className="mb-1.5 block text-[11px] text-text-secondary">Filter</span>
                    <div className="grid grid-cols-4 gap-1">
                      {FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => updateLayer(selected.id, { filter: filter.id })}
                          aria-pressed={(selected.filter ?? 'none') === filter.id}
                          className={cn(
                            'rounded border px-1 py-1 text-[9px] font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            (selected.filter ?? 'none') === filter.id
                              ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                              : 'border-bg-border text-text-secondary hover:text-text',
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="p-3">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Canvas</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBackground(null)}
                className={cn(
                  'flex-1 rounded border px-2 py-1.5 text-[10px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  background === null
                    ? 'border-studio-art/40 bg-studio-art/15 text-studio-art'
                    : 'border-bg-border text-text-secondary hover:text-text',
                )}
              >
                Transparent
              </button>
              <input
                type="color"
                value={background ?? '#000000'}
                onChange={(event) => setBackground(event.target.value)}
                className="h-7 w-14 cursor-pointer rounded border border-bg-border bg-bg-elevated"
                aria-label="Canvas background colour"
              />
            </div>
            <p className="mt-2 text-[10px] tabular-nums text-text-muted">
              {width} × {height} px
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function LayerNumber({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-2">
      <label htmlFor={id} className="text-[11px] text-text-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full accent-studio-art"
        />
        <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
          {step < 1 ? value.toFixed(2) : Math.round(value)}
        </span>
      </div>
    </div>
  )
}

export type { ArtLayer }
