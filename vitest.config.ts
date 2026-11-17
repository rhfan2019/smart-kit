import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The JSON results feed `npm run trace` (docs/13: every criterion must map to a passing test).
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/unit-results.json' },
    projects: [
      {
        test: {
          name: 'core',
          include: ['packages/core/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'react',
          include: ['packages/react/test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['packages/react/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'server',
          include: ['packages/server/test/**/*.test.ts', 'packages/cli/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'repo',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
