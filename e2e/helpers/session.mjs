import { expect } from "@playwright/test";
import { URL } from "node:url";

export async function browserSessionTokens(page) {
  const response = await page.request.post(
    new URL("/api/auth/refresh", page.url()).href,
  );
  expect(response.status()).toBe(200);
  expect(
    await page.evaluate(() =>
      globalThis.localStorage.getItem("eazicart.auth.tokens"),
    ),
  ).toBeNull();
  return (await response.json()).tokens;
}
