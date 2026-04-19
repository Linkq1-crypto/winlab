import { defineConfig, devices } from '@playwright/test';

const isProd = !!process.env.PROD || process.env.BASE_URL?.includes('winlab.cloud');
const BASE_URL = process.env.BASE_URL || (isProd ? 'https://winlab.cloud' : 'http://localhost:3001');

export default defineConfig({
  testDir: './tests',
  timeout: isProd ? 45000 : 30000,
  fullyParallel: !isProd,         // serial in prod — no hammering
  forbidOnly: !!process.env.CI,
  retries: isProd ? 2 : 1,
  workers: isProd ? 2 : undefined,

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: { 'x-test-run': 'playwright' },
  },

  reporter: [
    ['html', { outputFolder: 'qa-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'qa-report/results.json' }],
  ],

  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
