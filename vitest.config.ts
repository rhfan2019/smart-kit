import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // workspace packages from their sources (exports condition `smart-kit-source`, ADR-029); projects inherit this
  resolve: { conditions: ['smart-kit-source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['smart-kit-source', ...defaultServerConditions] } },
  test: {
    // The JSON results feed `npm run trace` (docs/13: every criterion must map to a passing test).
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/unit-results.json' },
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: ['packages/core/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'react',
          include: ['packages/react/test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['packages/react/test/setup.ts'],
          // UI tests drive menus and dialogs; on slow CI runners they need more than the default 5 s (D49)
          testTimeout: process.env.CI ? 30_000 : 5_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['packages/server/test/**/*.test.ts', 'packages/cli/test/**/*.test.ts'],
          environment: 'node',
          // conformance and write tests share the PostgreSQL test database: one file after another
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'repo',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
