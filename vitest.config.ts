import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    setupFiles: ["src/tests/setup.ts"],
    env: {
      KASIPOS_TEST_DB: "1",
    },
    sequence: {
      shuffle: false,
    },
    environmentMatchGlobs: [
      ["src/tests/**/*.test.tsx", "jsdom"],
      ["src/tests/hooks/**/*.test.tsx", "jsdom"],
      ["src/tests/hooks/**/*.test.ts", "jsdom"],
      ["src/tests/hooks/**", "jsdom"],
      ["src/tests/lib/cart-storage.test.ts", "jsdom"],
      ["src/tests/lib/db.test.ts", "jsdom"],
      ["src/tests/lib/entity-cache.test.ts", "jsdom"],
      ["src/tests/lib/store-persistence.test.ts", "jsdom"],
      ["src/tests/lib/mutation-queue.test.ts", "jsdom"],
      ["src/tests/lib/mutation-registry.test.ts", "jsdom"],
      ["src/tests/lib/offline-detector.test.ts", "jsdom"],
      ["src/tests/lib/auth-session.test.ts", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "src/**/*.d.ts",
        "src/ai/**",
        "src/types/**",
        "src/components/ui/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
