import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

const baseConfig: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  DATABASE_URL: "postgresql://localhost/eazicart",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  WEB_ORIGIN: "http://localhost:3000",
};

const apps: ReturnType<typeof buildApp>[] = [];
const makeApp = (config: AppConfig) => {
  const app = buildApp(config);
  apps.push(app);
  return app;
};

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("payment configuration", () => {
  it("reports unavailable when no payment credential is configured", async () => {
    const response = await makeApp(baseConfig).inject({
      method: "GET",
      url: "/payments/configuration",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { available: false } });
  });

  it("reports available without exposing the payment credential", async () => {
    const response = await makeApp({
      ...baseConfig,
      PAYSTACK_SECRET_KEY: "test-payment-secret",
    }).inject({
      method: "GET",
      url: "/payments/configuration",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { available: true } });
    expect(response.body).not.toContain("test-payment-secret");
  });
});
