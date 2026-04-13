import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    env: {
      KASIPOS_TEST_DB: '1',
    },
    sequence: {
      shuffle: false,
    },
    environmentMatchGlobs: [
      ['src/tests/**/*.test.tsx', 'jsdom'],
      ['src/tests/hooks/**/*.test.tsx', 'jsdom'],
      ['src/tests/hooks/**/*.test.ts', 'jsdom'],
      ['src/tests/hooks/**', 'jsdom'],
      ['src/tests/lib/cart-storage.test.ts', 'jsdom'],
      ['src/tests/lib/db.test.ts', 'jsdom'],
      ['src/tests/lib/entity-cache.test.ts', 'jsdom'],
      ['src/tests/lib/store-persistence.test.ts', 'jsdom'],
      ['src/tests/lib/mutation-queue.test.ts', 'jsdom'],
      ['src/tests/lib/mutation-registry.test.ts', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
