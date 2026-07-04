'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js in production (replaces next-pwa's injected register
 * script — next-pwa was webpack-only and kept the build off Turbopack).
 *
 * In development it does the opposite: unregisters any service worker and
 * purges caches left by a previous production build, because a stale SW
 * intercepting localhost navigations makes dev feel slow and stale.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.error('[PWA] service worker registration failed:', e)
      })
      return
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister())
    })
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
  }, [])

  return null
}
