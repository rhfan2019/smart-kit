import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the demo app against the PostgreSQL-backed purchasing service (apps/pg-server, ADR-027):
// /odata/purchasing/ comes from smart-kit-server on PostgreSQL; the other services and the supplier logos still come
// from the in-memory test service. Prerequisite: the database (npm run setup -w pg-server). Run: npm run e2e:pg.
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '4400';
const PG_PORT = process.env.E2E_PG_PORT ?? '4402';
const DEMO_PORT = process.env.E2E_PG_DEMO_PORT ?? '4403';
const MOCK = `http://localhost:${MOCK_PORT}`;
const PG = `http://localhost:${PG_PORT}`;
const DEMO = `http://localhost:${DEMO_PORT}`;

/**
 * Scenarios of the reused specs that need writes, bound actions or stored variants. This service is read-only
 * (ADR-027; writes are the next step, docs/12 D16); every other scenario of the reused specs runs.
 */
const NEEDS_WRITES = [
  'AC-LR-08 variants are stored', // saves a variant (Variants entity set)
  'AC-LR-14 initial focus', // saves a default variant first
  'P2-DPT-05', 'P2-DP-09', // Edit / Delete buttons in the header
  'P2-DPI-03', 'P2-OPC-08', // footer with Save / the determining actions
  'P2-LRA-02', 'P2-LRA-03', 'P2-LR-14', 'P2-LR-16', 'P2-LRC-11', // table and line item actions (approve, delete)
  'P2-LR-15', // create dialog
  'P2-LRC-03', // page variant
];

export default defineConfig({
  testDir: 'tests/e2e',
  // Reused UI specs (they read /odata/purchasing/, here from PostgreSQL) plus tests/e2e/pg.
  testMatch: ['list.spec.ts', 'object.spec.ts', 'nav.spec.ts', 'p2-list.spec.ts', 'p2-object.spec.ts', 'p2-dynamic-page.spec.ts', 'p3-microcharts.spec.ts', 'pg/**/*.spec.ts'],
  grepInvert: new RegExp(NEEDS_WRITES.join('|')),
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
      env: { PG_SERVER_PORT: PG_PORT },
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
