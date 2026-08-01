'use client'

import { useEffect, useMemo, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Download,
  Loader2,
  Smartphone,
  GalleryVertical,
  BookOpen,
  FileArchive,
  BookMarked,
  FileText,
  FileCode,
  FileImage,
  Image as ImageIcon,
  Braces,
  type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportIcon,
  type ExportMeta,
  type ExportResult,
  type PanelSource,
  type ProgressFn,
} from '@/lib/webtoon/export/formats'
import { canEncode } from '@/lib/webtoon/export/imageOps'
import { runExportFromSource, downloadResult } from '@/lib/webtoon/export/run'

const ICONS: Record<ExportIcon, LucideIcon> = {
  webtoon: Smartphone,
  tapas: GalleryVertical,
  mangadex: BookOpen,
  zip: FileArchive,
  cbz: BookMarked,
  pdf: FileText,
  png: FileImage,
  jpg: ImageIcon,
  webp: FileImage,
  avif: FileImage,
  html: FileCode,
  json: Braces,
}

/** Prepared panels + metadata, returned by `prepare` when a format is chosen. */
export interface PreparedExport {
  source: PanelSource
  meta: ExportMeta
  /** Teardown run after the export finishes or fails (e.g. restore editor state). */
  cleanup?: () => void
}

/** A bespoke export action beyond the shared registry (e.g. editor's merged strip). */
export interface ExtraExportItem {
  id: string
  label: string
  hint: string
  group: string
  icon: LucideIcon
  /** `ctx` (source + meta) is available but optional — many actions ignore it. */
  run: (onProgress: ProgressFn, ctx: { source: PanelSource; meta: ExportMeta }) => Promise<ExportResult>
}

interface ExportMenuProps {
  /** Gather the panels to export. Runs once per chosen format. */
  prepare: () => Promise<PreparedExport>
  triggerClassName?: string
  triggerLabel?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  /** Extra actions rendered first, above the standard formats. */
  extraItems?: ExtraExportItem[]
}

const GROUP_ORDER = ['Platforms', 'Archives', 'Documents', 'Image sequences', 'Data'] as const

export default function ExportMenu({
  prepare,
  triggerClassName,
  triggerLabel = 'Download',
  side = 'bottom',
  align = 'end',
  disabled = false,
  extraItems,
}: ExportMenuProps) {
  const [busy, setBusy] = useState(false)
  // Probe codec support once so WebP/AVIF disable gracefully where unsupported.
  const [caps, setCaps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    const needed = Array.from(
      new Set(EXPORT_FORMATS.map((f) => f.requiresMime).filter((m): m is string => !!m))
    )
    Promise.all(needed.map(async (m) => [m, await canEncode(m)] as const)).then((pairs) => {
      if (alive) setCaps(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, ExportFormat[]>()
    for (const f of EXPORT_FORMATS) {
      const list = map.get(f.group) ?? []
      list.push(f)
      map.set(f.group, list)
    }
    return GROUP_ORDER.map((g) => [g, map.get(g) ?? []] as const).filter(([, list]) => list.length)
  }, [])

  async function execute(
    label: string,
    task: (ctx: { source: PanelSource; meta: ExportMeta }, onProgress: ProgressFn) => Promise<ExportResult>
  ) {
    if (busy) return
    setBusy(true)
    const toastId = toast.loading(`Preparing ${label}…`)
    let cleanup: (() => void) | undefined
    try {
      const prepared = await prepare()
      cleanup = prepared.cleanup
      const onProgress: ProgressFn = (done, total, phase) => {
        const pct = total ? Math.round((done / total) * 100) : 0
        toast.loading(`${phase}… ${pct}%`, { id: toastId })
      }
      const result = await task({ source: prepared.source, meta: prepared.meta }, onProgress)
      downloadResult(result)
      toast.success(`${label} ready`, { id: toastId })
    } catch (err) {
      console.error('Export failed:', err)
      toast.error(err instanceof Error ? err.message : 'Export failed', { id: toastId })
    } finally {
      cleanup?.()
      setBusy(false)
    }
  }

  return (
    <DropdownMenu.Root>
      <Tooltip label={triggerLabel} side={side}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={busy || disabled}
            aria-label={triggerLabel}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              triggerClassName ?? 'text-text-muted hover:text-text hover:bg-bg-elevated'
            )}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-50 w-72 max-h-[70vh] overflow-y-auto bg-bg-card border border-bg-border rounded-xl p-1.5 shadow-xl',
            'data-[state=open]:animate-fade-in'
          )}
          side={side}
          align={align}
          sideOffset={8}
          role="menu"
          aria-label="Download as"
        >
          <div className="px-2 py-2 mb-1 border-b border-bg-border">
            <p className="text-sm font-semibold text-text">Download episode</p>
            <p className="text-xs text-text-muted mt-0.5">Choose a platform or format</p>
          </div>

          {extraItems && extraItems.length > 0 && (
            <div>
              <SectionLabel>{extraItems[0].group}</SectionLabel>
              {extraItems.map((item) => (
                <Row
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  hint={item.hint}
                  disabled={busy}
                  onSelect={() => void execute(item.label, (ctx, onProgress) => item.run(onProgress, ctx))}
                />
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />
            </div>
          )}

          {grouped.map(([group, formats], gi) => (
            <div key={group}>
              {gi > 0 && <DropdownMenu.Separator className="my-1 h-px bg-bg-border" />}
              <SectionLabel>{group}</SectionLabel>
              {formats.map((format) => {
                const unsupported = !!format.requiresMime && caps[format.requiresMime] === false
                return (
                  <Row
                    key={format.id}
                    icon={ICONS[format.icon]}
                    label={format.label}
                    hint={unsupported ? 'Not supported in this browser' : format.hint}
                    disabled={busy || unsupported}
                    onSelect={() =>
                      void execute(format.label, (ctx, onProgress) =>
                        runExportFromSource(format.id, ctx.source, ctx.meta, onProgress)
                      )
                    }
                  />
                )
              })}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
      {children}
    </DropdownMenu.Label>
  )
}

function Row({
  icon: Icon,
  label,
  hint,
  disabled,
  onSelect,
}: {
  icon: LucideIcon
  label: string
  hint: string
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer outline-none',
        'text-text-secondary hover:bg-bg-elevated hover:text-text',
        'focus-visible:bg-bg-elevated focus-visible:text-text',
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent'
      )}
      role="menuitem"
    >
      <span
        className="flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-bg-elevated text-accent"
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text truncate">{label}</span>
        <span className="block text-xs text-text-muted truncate">{hint}</span>
      </span>
    </DropdownMenu.Item>
  )
}
