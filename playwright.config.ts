import { defineConfig, devices } from '@playwright/test';

const MOCK = 'http://localhost:4400';
const DEMO = 'http://localhost:4401';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: DEMO,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run mock',
      url: `${MOCK}/odata/purchasing/$metadata`,
      env: { E2E: '1' },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'npm run dev -w demo',
      url: DEMO,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
