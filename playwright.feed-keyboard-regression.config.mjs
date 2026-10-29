import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['feed-comments-keyboard-dismissal.spec.mjs'],
  use: { baseURL: 'http://127.0.0.1:3113' },
  workers: 1,
  retries: 0,
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
