import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the demo app against the PostgreSQL-backed purchasing service (apps/pg-server, ADR-027):
// /odata/purchasing/ comes from smart-kit-server on PostgreSQL; the other services and the supplier logos still come
// from the in-memory test service (the draft service too: drafts are not part of the PostgreSQL service).
// Prerequisite: the database (npm run pg:setup). Run: npm run e2e:pg.
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '4400';
const PG_PORT = process.env.E2E_PG_PORT ?? '4402';
const DEMO_PORT = process.env.E2E_PG_DEMO_PORT ?? '4403';
const MOCK = `http://localhost:${MOCK_PORT}`;
const PG = `http://localhost:${PG_PORT}`;
const DEMO = `http://localhost:${DEMO_PORT}`;

// The specs read and reset this service through helpers.ts (PURCHASING, resetServer). Set here so that the test
// workers inherit them.
process.env.E2E_PURCHASING_URL = `${PG}/odata/purchasing`;
process.env.E2E_EXTRA_RESET = `${PG}/test/reset`;

export default defineConfig({
  testDir: 'tests/e2e',
  // Reused UI specs (they read /odata/purchasing/, here from PostgreSQL) plus tests/e2e/pg.
  // The draft scenarios of p2-edit / p2-server use the draft service, which stays on the in-memory test service.
  testMatch: [
    'list.spec.ts', 'object.spec.ts', 'nav.spec.ts', 'edit-seam.spec.ts', 'p2-list.spec.ts', 'p2-object.spec.ts', 'p2-edit.spec.ts',
    'p2-dynamic-page.spec.ts', 'p2-server.spec.ts', 'p3-microcharts.spec.ts', 'p5-totals.spec.ts', 'pg/**/*.spec.ts',
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list'], ['json', { outputFile: 'reports/e2e-pg-results.json' }]] : [['list'], ['json', { outputFile: 'reports/e2e-pg-results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: DEMO,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'postgres' }],
  webServer: [
    {
      command: 'npm run mock',
      url: `${MOCK}/odata/purchasing/$metadata`,
      env: { E2E: '1', MOCK_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'npm run start -w pg-server',
      url: `${PG}/odata/purchasing/$metadata`,
      env: { PG_SERVER_PORT: PG_PORT, E2E: '1' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w demo -- --port ${DEMO_PORT} --strictPort`,
      env: { MOCK_URL: MOCK, PURCHASING_URL: PG },
      url: DEMO,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
