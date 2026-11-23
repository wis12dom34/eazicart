import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/multi-account",
  timeout: 90000,
  webServer: [
    {
      command: "pnpm --filter @eazicart/api start",
      url: "http://127.0.0.1:3001/health",
      env: {
        HOST: "127.0.0.1",
        PORT: "3001",
        WEB_ORIGIN: "https://127.0.0.1:3443",
        BROWSER_ACCOUNTS_ENABLED: "1",
        NODE_ENV: "production",
      },
    },
    {
      command: "pnpm --filter @eazicart/web start --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000/login",
    },
    {
      command: "node e2e/multi-account/proxy.mjs",
      url: "https://127.0.0.1:3443/api/health",
      ignoreHTTPSErrors: true,
    },
  ],
});
