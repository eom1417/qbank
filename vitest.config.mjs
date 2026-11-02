import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // Integration suites share one test database; run files one at a time.
    fileParallelism: false,
  },
});
