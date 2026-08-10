import { defineConfig } from 'vitest/config'

// Firestore security-rules tests. Separate from vitest.config.ts because these
// need the Firestore emulator running (`npm run test:rules` starts it via the
// firebase CLI, which needs a JRE) — the default `npm test` suite must stay
// dependency-free and instant.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['security/**/*.test.ts'],
    // Rules tests share one emulator + one Firestore state, so they must not
    // interleave.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
