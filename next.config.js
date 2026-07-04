/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
      { source: '/icons/:path*', headers: immutableCache },
      { source: '/images/:path*', headers: immutableCache },
      { source: '/og-image.png', headers: immutableCache },
    ]
  },
}

// PWA: manifest.json + hand-rolled public/sw.js registered by
// <PwaRegister /> in the root layout. No bundler plugin needed —
// dev AND build both run fully on Turbopack (webpack-free).
module.exports = nextConfig
