/** @type {import('next').NextConfig} */

// Content-Security-Policy — the primary defence-in-depth against XSS/data
// exfiltration/clickjacking. The allowlist is scoped to exactly the third
// parties the app talks to (Firebase Auth/Firestore/Storage, Google sign-in,
// Razorpay checkout). Everything else is denied.
//
// NOTE on script-src 'unsafe-inline': Next.js App Router injects inline
// hydration/bootstrap scripts. Removing 'unsafe-inline' requires a per-request
// nonce wired through middleware (see SECURITY.md "CSP nonce upgrade"). Even
// with inline scripts allowed, this policy still blocks the high-value vectors:
// no arbitrary external script hosts, no object/embed, no framing, locked
// base-uri and form-action, restricted connect/img/frame origins.
//
// 'unsafe-eval' is dev-only: React/Next dev tooling (error overlay, callstack
// reconstruction, source maps) needs eval(); React never uses eval() in prod.
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://checkout.razorpay.com https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://picsum.photos https://*.gstatic.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://accounts.google.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Force HTTPS for two years incl. subdomains; eligible for the preload list.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Allow Firebase Google sign-in popups while isolating our browsing context.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=(), payment=(self "https://checkout.razorpay.com"), usb=(), serial=(), bluetooth=()',
  },
  { key: 'X-Powered-By', value: '' },
]

// Static assets rarely change — cache hard at the edge and in the browser.
const immutableCache = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
]

const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // WARNING: these paths are cached for a year with no revalidation, so a
      // file here can NEVER be changed in place — every prior visitor would keep
      // the old bytes until 2027. Ship a new *filename* instead (the icons are
      // versioned: icon-192.v2.png), and bump CACHE_VERSION in public/sw.js,
      // which caches the same paths cache-first. `npm run icons` regenerates them.
      { source: '/icons/:path*', headers: immutableCache },
      { source: '/images/:path*', headers: immutableCache },
    ]
  },
}

// PWA: manifest.json + hand-rolled public/sw.js registered by
// <PwaRegister /> in the root layout. No bundler plugin needed —
// dev AND build both run fully on Turbopack (webpack-free).
module.exports = nextConfig
