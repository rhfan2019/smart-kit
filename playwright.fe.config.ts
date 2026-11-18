import { defineConfig, devices } from '@playwright/test';

// Fiori elements comparison (docs/30 §7.2, npm run e2e:fe): the FE reference app (apps/fe-reference, SAPUI5 1.154.0
// loaded from ui5.sap.com at runtime) against the smart-kit demo, both on the test service.
// E2E_MOCK_PORT / E2E_DEMO_PORT / FE_PORT let the tests run next to servers a developer already has on 4400 / 4401 / 4420.
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '4400';
const DEMO_PORT = process.env.E2E_DEMO_PORT ?? '4401';
const FE_PORT = process.env.FE_PORT ?? '4420';
const MOCK = `http://localhost:${MOCK_PORT}`;
const DEMO = `http://localhost:${DEMO_PORT}`;
const FE = `http://localhost:${FE_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e-fe',
  // SAPUI5 comes from the CDN: generous timeouts for the first (uncached) load
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // the JSON results feed `npm run trace` (docs/32 appendix, AL-21)
  reporter: process.env.CI ? [['github'], ['list'], ['json', { outputFile: 'reports/e2e-fe-results.json' }]] : [['list'], ['json', { outputFile: 'reports/e2e-fe-results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    // wide enough that neither table virtualizes columns away
    viewport: { width: 2400, height: 1100 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run mock',
      url: `${MOCK}/odata/purchasing/$metadata`,
      env: { E2E: '1', MOCK_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: `npm run dev -w demo -- --port ${DEMO_PORT} --strictPort`,
      env: { MOCK_URL: MOCK },
      url: DEMO,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node apps/fe-reference/server.mjs',
      env: { MOCK_URL: MOCK, FE_PORT },
      url: `${FE}/index.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
