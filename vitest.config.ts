import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['gate/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '.stryker-tmp*/**'],
    environment: 'node',
    // The tests' temporary files go under one directory of the run's, removed when it ends.
    globalSetup: ['tests/tmp-setup.ts'],
    setupFiles: ['tests/tmp-each.ts'],
    // The gate's fixture tests build small repositories on disk; give them room on a slow machine.
    testTimeout: 30_000,
  },
});
