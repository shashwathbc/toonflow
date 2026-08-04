'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ArrowRight, ArrowLeft, Check, Sparkles, PartyPopper, Compass } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { updateUserProfile } from '@/lib/firebase/firestore'
import { TOUR_STEPS, type TourPlacement } from '@/lib/tour/steps'
import { useTourStore } from '@/store/useTourStore'
import { markTourSeen, saveTourIndex } from '@/lib/tour/storage'
import { trackTour } from '@/lib/tour/analytics'
import { YoutubeIcon, InstagramIcon, XIcon, LinkedinIcon } from '@/components/ui/BrandIcons'
import Confetti from './Confetti'
import { cn } from '@/lib/utils/cn'

const TOTAL = TOUR_STEPS.length
const LAST = TOTAL - 1

const REFERRAL_OPTIONS = [
  { id: 'x', label: 'X (Twitter)', icon: XIcon },
  { id: 'youtube', label: 'YouTube', icon: YoutubeIcon },
  { id: 'instagram', label: 'Instagram', icon: InstagramIcon },
  { id: 'linkedin', label: 'LinkedIn', icon: LinkedinIcon },
] as const

interface Box { top: number; left: number; width: number; height: number }
interface Size { w: number; h: number }

const TIP = { w: 360, h: 220 } // estimate used before the tooltip is measured

function computeTooltipPos(hole: Box, placement: TourPlacement, tip: Size, vp: Size): { top: number; left: number } {
  const gap = 14
  const cx = hole.left + hole.width / 2
  const cy = hole.top + hole.height / 2
  let top = 0
  let left = 0
  switch (placement) {
    case 'top': top = hole.top - tip.h - gap; left = cx - tip.w / 2; break
    case 'bottom': top = hole.top + hole.height + gap; left = cx - tip.w / 2; break
    case 'left': left = hole.left - tip.w - gap; top = cy - tip.h / 2; break
    case 'right': left = hole.left + hole.width + gap; top = cy - tip.h / 2; break
  }
  // Flip to the opposite side if it would spill off-screen.
  if (placement === 'top' && top < 8) top = hole.top + hole.height + gap
  if (placement === 'bottom' && top + tip.h > vp.h - 8) top = hole.top - tip.h - gap
  if (placement === 'left' && left < 8) left = hole.left + hole.width + gap
  if (placement === 'right' && left + tip.w > vp.w - 8) left = hole.left - tip.w - gap
  // Keep fully inside the viewport.
  left = Math.max(8, Math.min(left, vp.w - tip.w - 8))
  top = Math.max(8, Math.min(top, vp.h - tip.h - 8))
  return { top, left }
}

export default function TourOverlay() {
  const active = useTourStore((s) => s.active)
  const index = useTourStore((s) => s.index)
  const referralSource = useTourStore((s) => s.referralSource)
  const startedAt = useTourStore((s) => s.startedAt)
  const next = useTourStore((s) => s.next)
  const prev = useTourStore((s) => s.prev)
  const setReferral = useTourStore((s) => s.setReferral)
  const reset = useTourStore((s) => s.reset)

  const { firebaseUser, refreshProfile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  const [rect, setRect] = useState<DOMRect | null>(null)
  const [vp, setVp] = useState<Size>(() =>
    typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 0, h: 0 },
  )
  const [tipSize, setTipSize] = useState<Size>(TIP)
  const tipRef = useRef<HTMLDivElement | null>(null)

  const step = TOUR_STEPS[index]
  const isBigCard = step.kind === 'welcome' || step.kind === 'finish'

  // ── Persist completion (best-effort; never blocks closing) ──────────────
  const persistDone = useCallback(async (source: string | null) => {
    if (!firebaseUser) return
    try {
      await updateUserProfile(firebaseUser.uid, {
        hasOnboarded: true,
        ...(source ? { referralSource: source } : {}),
      })
      await refreshProfile()
    } catch (e) {
      console.error('[tour] could not save completion:', e)
    }
  }, [firebaseUser, refreshProfile])

  const elapsed = useCallback(() => (startedAt ? Date.now() - startedAt : 0), [startedAt])

  // Explicit "Skip" — ends the tour for good.
  const handleSkip = useCallback(() => {
    if (firebaseUser) markTourSeen(firebaseUser.uid)
    trackTour('tour_skipped', { index, id: TOUR_STEPS[index].id })
    trackTour('tour_time_spent', { ms: elapsed(), completed: false })
    void persistDone(referralSource)
    reset()
  }, [firebaseUser, index, elapsed, persistDone, referralSource, reset])

  // ESC / close button — pause; resume from here next time.
  const handleClose = useCallback(() => {
    if (firebaseUser) saveTourIndex(firebaseUser.uid, index)
    trackTour('tour_time_spent', { ms: elapsed(), completed: false, paused: true })
    reset()
  }, [firebaseUser, index, elapsed, reset])

  // Finish CTAs — completes the tour and navigates.
  const handleComplete = useCallback((dest: string) => {
    if (firebaseUser) markTourSeen(firebaseUser.uid)
    trackTour('tour_completed', { steps: TOTAL })
    trackTour('tour_time_spent', { ms: elapsed(), completed: true })
    void persistDone(referralSource)
    reset()
    router.push(dest)
  }, [firebaseUser, elapsed, persistDone, referralSource, reset, router])

  const handleNext = useCallback(() => { if (index < LAST) next() }, [index, next])
  const handlePrev = useCallback(() => { if (index > 0) prev() }, [index, prev])

  // ── Resolve the target element for the current step ─────────────────────
  // All setState is deferred into rAF/listeners (never synchronous in the effect
  // body) per the codebase's react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!active) return
    const s = TOUR_STEPS[index]
    let cancelled = false
    let raf = 0
    let tries = 0

    // Navigate to the step's page first; the pathname change re-runs this effect.
    if (s.route && pathname !== s.route) {
      router.push(s.route)
      raf = requestAnimationFrame(() => { if (!cancelled) setRect(null) })
      return () => { cancelled = true; cancelAnimationFrame(raf) }
    }
    if (!s.target) {
      raf = requestAnimationFrame(() => { if (!cancelled) setRect(null) })
      return () => { cancelled = true; cancelAnimationFrame(raf) }
    }

    const find = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(s.target!)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
        raf = requestAnimationFrame(() => { if (!cancelled) setRect(el.getBoundingClientRect()) })
      } else if (tries < 80) {
        tries += 1
        raf = requestAnimationFrame(find)
      } else {
        setRect(null) // give up → graceful centered card (this runs inside rAF)
      }
    }
    raf = requestAnimationFrame(find)
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [active, index, pathname, router, reduceMotion])

  // Keep the spotlight glued to the target through scroll / resize / layout shifts.
  // Updates only fire from listeners / the interval (async), never synchronously.
  useEffect(() => {
    if (!active) return
    const measure = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      const s = TOUR_STEPS[index]
      if (s.target) {
        const el = document.querySelector<HTMLElement>(s.target)
        if (el) setRect(el.getBoundingClientRect())
      }
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const id = window.setInterval(measure, 500)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.clearInterval(id)
    }
  }, [active, index])

  // Measure the tooltip so it can be clamped/positioned accurately (deferred).
  useEffect(() => {
    if (!active) return
    const raf = requestAnimationFrame(() => {
      const el = tipRef.current
      if (el) setTipSize({ w: el.offsetWidth, h: el.offsetHeight })
    })
    return () => cancelAnimationFrame(raf)
  }, [active, index, rect])

  // Analytics: step viewed.
  useEffect(() => {
    if (!active) return
    trackTour('tour_step_viewed', { index, id: TOUR_STEPS[index].id })
  }, [active, index])

  // Keyboard: ESC closes, arrows navigate, Tab is trapped inside the panel.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); return }
      if (e.key === 'ArrowRight') { handleNext(); return }
      if (e.key === 'ArrowLeft') { handlePrev(); return }
      if (e.key === 'Tab') {
        const panel = tipRef.current
        if (!panel) return
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, handleClose, handleNext, handlePrev])

  // Move focus into the panel on each step so keyboard users land in the tour.
  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      tipRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [active, index])

  const pad = step.padding ?? 8
  const hole: Box | null = rect && vp.w > 0
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: Math.min(vp.w, rect.right + pad) - Math.max(0, rect.left - pad),
        height: Math.min(vp.h, rect.bottom + pad) - Math.max(0, rect.top - pad),
      }
    : null

  // Match the app's own layout breakpoint (`md`, 768px — where MobileNav takes
  // over) so "phone" here means exactly what it means everywhere else. This closes
  // the 640–767px dead zone where the app showed its mobile UI but the tour still
  // squeezed a desktop side-tooltip beside the target (which, under a scaled/framed
  // preview viewport, landed off-screen and clipped).
  const isMobile = vp.w > 0 && vp.w < 768
  const isSpotlightStep = !isBigCard
  const hasHole = hole !== null
  // The dimmed cutout (spotlight panes + ring) appears once the target is measured.
  const showSpotlight = isSpotlightStep && hasHole
  // Panel layout, chosen so the panel NEVER flashes through the centered state on its
  // way to the phone bottom-sheet — that transient is what left a sticky x:'-50%'
  // transform (see below) and dragged the sheet off-screen:
  //  • bottomSheet — spotlight steps on phones. CSS-pinned to the bottom (`inset-x-4`
  //    + `bottom`), independent of the measured target, so it renders correctly
  //    immediately — even before the hole is found.
  //  • sideTooltip — spotlight steps on desktop, positioned beside the measured target.
  //  • centered — welcome/finish cards, plus the brief pre-measure state on desktop.
  const bottomSheet = isSpotlightStep && isMobile
  const sideTooltip = isSpotlightStep && !isMobile && hasHole
  const centered = !bottomSheet && !sideTooltip
  const tipPos = sideTooltip
    ? computeTooltipPos(hole!, step.placement ?? 'bottom', tipSize, vp)
    : null

  // Framer owns the transform, so EVERY state must set x/y explicitly. Otherwise a
  // value from a previous state (notably the centered card's x/y:'-50%') sticks when
  // the panel switches layout and drags it out of view. Centered cards translate by
  // -50%/-50% to self-center; sheets and side tooltips sit at 0/0. x/y snap instantly
  // (per-axis transition on the panel) so a layout switch never slides the panel across.
  const tx = centered ? '-50%' : '0%'
  const ty = centered ? '-50%' : '0%'
  const panelStyle = centered
    ? { left: '50%', top: '50%' }
    : bottomSheet
      ? { bottom: 16 }
      : tipPos ? { top: tipPos.top, left: tipPos.left } : undefined
  const panelInitial = reduceMotion
    ? { opacity: 0, x: tx, y: ty }
    : { opacity: 0, scale: 0.98, x: tx, y: ty }
  const panelAnimate = reduceMotion
    ? { opacity: 1, x: tx, y: ty }
    : { opacity: 1, scale: 1, x: tx, y: ty }

  const dim = 'bg-black/70 backdrop-blur-sm'

  return (
    <AnimatePresence>
      {active && (
      <motion.div
        key="tour-root"
        className="fixed inset-0 z-[110]"
        role="dialog"
        aria-modal="true"
        aria-label="Product tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {showSpotlight ? (
          <>
            {/* Blurred + dimmed cutout: four panes around the highlighted element.
                Each pane blocks clicks so unrelated UI can't be used mid-step. */}
            <div className={cn('absolute', dim)} style={{ top: 0, left: 0, width: '100%', height: hole!.top }} />
            <div className={cn('absolute', dim)} style={{ top: hole!.top + hole!.height, left: 0, width: '100%', height: `calc(100% - ${hole!.top + hole!.height}px)` }} />
            <div className={cn('absolute', dim)} style={{ top: hole!.top, left: 0, width: hole!.left, height: hole!.height }} />
            <div className={cn('absolute', dim)} style={{ top: hole!.top, left: hole!.left + hole!.width, width: `calc(100% - ${hole!.left + hole!.width}px)`, height: hole!.height }} />
            {/* Transparent blocker over the highlighted element itself. */}
            <div className="absolute" style={{ top: hole!.top, left: hole!.left, width: hole!.width, height: hole!.height }} />
            {/* Glowing ring */}
            <motion.div
              className="absolute rounded-xl ring-2 ring-white pointer-events-none"
              style={{ top: hole!.top, left: hole!.left, width: hole!.width, height: hole!.height, boxShadow: '0 0 0 3px rgba(255,255,255,0.15), 0 0 28px 6px rgba(255,255,255,0.35)' }}
              initial={reduceMotion ? undefined : { opacity: 0.6, scale: 1.02 }}
              animate={reduceMotion ? undefined : { opacity: [0.75, 1, 0.75], scale: [1, 1.012, 1] }}
              transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : (
          /* Welcome / finish / graceful-fallback: full dim behind a centered card. */
          <div className={cn('absolute inset-0', dim)} />
        )}

        {/* ── Panel (floating tooltip or centered card) ─────────────────── */}
        <motion.div
          ref={tipRef}
          key={`panel-${step.id}`}
          className={cn(
            'absolute bg-bg-card border border-bg-border rounded-2xl shadow-2xl',
            'p-5 focus:outline-none max-h-[85dvh] overflow-y-auto overscroll-contain',
            bottomSheet
              ? 'inset-x-4 w-auto max-w-none'
              : cn('w-[calc(100vw-2rem)]', centered ? 'max-w-md' : 'max-w-sm'),
          )}
          style={panelStyle}
          initial={panelInitial}
          animate={panelAnimate}
          transition={{ duration: 0.2, ease: 'easeOut', x: { duration: 0 }, y: { duration: 0 } }}
        >
          <PanelHeader onClose={handleClose} />

          {/* Progress */}
          <div className="mb-3">
            <div className="h-1 rounded-full bg-bg-elevated overflow-hidden" aria-hidden="true">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={false}
                animate={{ width: `${(index / LAST) * 100}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-text-muted tabular-nums">
              {step.kind === 'welcome' ? 'About 2 minutes' : step.kind === 'finish' ? 'All done' : `Step ${index} of ${LAST - 1}`}
            </p>
          </div>

          {/* Icon (big cards only) */}
          {isBigCard && (
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-bg-border bg-bg-elevated">
              {step.kind === 'finish'
                ? <PartyPopper size={22} className="text-accent" aria-hidden="true" />
                : <Sparkles size={22} className="text-accent" aria-hidden="true" />}
            </div>
          )}

          <h2 className={cn('font-bold text-text', isBigCard ? 'text-xl mb-2' : 'text-base mb-1.5')}>
            {step.title}
          </h2>
          <p className={cn('text-text-secondary leading-relaxed', isBigCard ? 'text-sm' : 'text-[13px]')}>
            {step.body}
          </p>

          {/* Welcome: referral survey */}
          {step.kind === 'welcome' && (
            <fieldset className="mt-4">
              <legend className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-2">
                <Compass size={13} aria-hidden="true" /> Where did you hear about us?
              </legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where did you hear about us">
                {REFERRAL_OPTIONS.map(({ id, label, icon: Icon }) => {
                  const selected = referralSource === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReferral(id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        selected
                          ? 'border-accent bg-white/10 text-text shadow-[0_0_0_1px_rgba(255,255,255,0.35)]'
                          : 'border-bg-border text-text-secondary hover:border-bg-border-strong hover:text-text',
                      )}
                    >
                      <Icon size={15} className={selected ? 'text-accent' : 'text-text-muted'} aria-hidden={true} />
                      <span className="flex-1 text-left truncate">{label}</span>
                      {selected && <Check size={14} className="shrink-0 text-accent" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {/* Footer actions */}
          <div className="mt-5 flex items-center justify-between gap-3">
            {step.kind === 'welcome' ? (
              <>
                <button type="button" onClick={handleSkip} className="text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 py-1">
                  Skip
                </button>
                <button type="button" data-tour-primary onClick={handleNext} className="btn-accent px-5 py-2.5">
                  Start tour <ArrowRight size={16} aria-hidden="true" />
                </button>
              </>
            ) : step.kind === 'finish' ? (
              <div className="flex w-full flex-col gap-2">
                <button type="button" data-tour-primary onClick={() => handleComplete('/create')} className="btn-accent w-full justify-center py-2.5">
                  Create my first webtoon <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => handleComplete('/browse')} className="btn-ghost w-full justify-center py-2.5">
                  Explore comics
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={index <= 1}
                  className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 py-1"
                >
                  <ArrowLeft size={14} aria-hidden="true" /> Back
                </button>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={handleSkip} className="text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 py-1">
                    Skip tour
                  </button>
                  <button type="button" data-tour-primary onClick={handleNext} className="btn-accent px-4 py-2">
                    {index === LAST - 1 ? 'Finish' : 'Next'} <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {step.kind === 'finish' && <Confetti />}
      </motion.div>
      )}
    </AnimatePresence>
  )
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close tour (you can resume later)"
      className="absolute right-3 top-3 p-1.5 rounded-full text-text-muted hover:text-text hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <X size={15} aria-hidden="true" />
    </button>
  )
}
