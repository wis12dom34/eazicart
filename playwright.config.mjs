import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @eazicart/api start",
      url: "http://localhost:3001/health",
      reuseExistingServer: false,
      env: { NODE_ENV: "test" },
    },
    {
      command: "pnpm --filter @eazicart/web start",
      url: "http://localhost:3000",
      reuseExistingServer: false,
    },
  ],
});
