import { defineConfig } from 'vitest/config';

// Scale checks (M17.5): `npm run bench:perf`. Slow by design, so apart from the normal suite.
export default defineConfig({
  test: {
    include: ['tests/perf/**/*.perf.ts'],
    fileParallelism: false,
    testTimeout: 30 * 60_000,
    hookTimeout: 30 * 60_000,
  },
});
