'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * State that automatically reverts to its resting value after a delay.
 *
 * Built for the "Saved ✓ → (2s) → idle" badges in the studio. Those were
 * previously written as bare `setTimeout(() => setSaveState('idle'), 2000)` at
 * ten different call sites, none of which held a handle to the timer — so none
 * of them could clear it. Leaving the page inside the window fired a setState
 * on an unmounted component and kept the enclosing closure alive until it did.
 *
 * This owns the handle, clears the previous timer whenever a new transient
 * value is set (so rapid saves don't stack up), and clears on unmount.
 *
 *   const [saveState, setSaveState] = useTransientState<SaveState>('idle')
 *   setSaveState('saving')            // sticky — no auto-revert
 *   setSaveState('saved', 2000)       // reverts to 'idle' after 2s
 *
 * Passing no duration makes the value sticky, which is what transitional states
 * like 'saving' need — they're cleared by the next explicit set, not a clock.
 */
export function useTransientState<T>(
  restingValue: T
): [T, (next: T, revertAfterMs?: number) => void] {
  const [value, setValue] = useState<T>(restingValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kept in a ref so `set` can stay referentially stable across renders — it's
  // frequently used inside useCallback/useEffect dependency lists. Synced in an
  // effect rather than assigned during render, which the React Compiler lint
  // (correctly) rejects as a render-phase side effect.
  const restingRef = useRef(restingValue)
  useEffect(() => {
    restingRef.current = restingValue
  }, [restingValue])

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const set = useCallback(
    (next: T, revertAfterMs?: number) => {
      clear()
      setValue(next)
      if (revertAfterMs !== undefined) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          setValue(restingRef.current)
        }, revertAfterMs)
      }
    },
    [clear]
  )

  useEffect(() => clear, [clear])

  return [value, set]
}

export default useTransientState
