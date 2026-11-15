import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
          name: 'repo',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
