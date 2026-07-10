import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests target the pure, dependency-free logic (money math, timestamp
// helpers, formatters, HTML escaping). They run in the Node environment and
// never touch Firebase, Next, or the network.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
