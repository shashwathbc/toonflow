import { create } from 'zustand'
import { TOUR_STEPS } from '@/lib/tour/steps'

/**
 * Pure UI state for the product tour. Kept in a Zustand store (not React state) so
 * the first-run auto-start effect in TourManager can trigger it without a
 * setState-inside-effect (react-hooks/set-state-in-effect). Persistence, analytics
 * and navigation side-effects live in the overlay, which wraps these actions.
 */
interface TourStore {
  active: boolean
  index: number
  /** Referral source picked on the welcome screen ("where did you hear about us"). */
  referralSource: string | null
  /** Epoch ms the tour started — drives the "time spent" analytics event. */
  startedAt: number | null
  start: (atIndex?: number) => void
  goTo: (index: number) => void
  next: () => void
  prev: () => void
  setReferral: (source: string | null) => void
  reset: () => void
}

const LAST = TOUR_STEPS.length - 1
const clamp = (i: number) => Math.min(Math.max(i, 0), LAST)

export const useTourStore = create<TourStore>((set) => ({
  active: false,
  index: 0,
  referralSource: null,
  startedAt: null,
  start: (atIndex = 0) => set({ active: true, index: clamp(atIndex), startedAt: Date.now() }),
  goTo: (index) => set({ index: clamp(index) }),
  next: () => set((s) => ({ index: clamp(s.index + 1) })),
  prev: () => set((s) => ({ index: clamp(s.index - 1) })),
  setReferral: (referralSource) => set({ referralSource }),
  reset: () => set({ active: false, index: 0, referralSource: null, startedAt: null }),
}))
