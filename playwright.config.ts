import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/**
 * Smoke tests for things that are invisible in unit tests but easy to break:
 * a sticky header that stops sticking, a menu that never closes, a title that
 * gets squeezed to nothing. They run against the dev server so there is no
 * build step to forget.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    // The two widths the layout actually broke at: 1280 is the narrowest
    // viewport where the badge row shows, 390x844 is the mobile case that was
    // reported.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
