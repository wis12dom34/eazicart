import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  devices,
  expect,
  request as playwrightRequest,
  test,
  webkit,
} from "@playwright/test";

test("saved accounts survive mobile WebKit restart and stay isolated across tabs", async () => {
  const baseURL = "https://127.0.0.1:3443";
  const profile = await mkdtemp(join(tmpdir(), "eazicart-webkit-"));
  const launch = () =>
    webkit.launchPersistentContext(profile, {
      ...devices["iPhone 13"],
      baseURL,
      ignoreHTTPSErrors: true,
    });
  let context;
  async function call(page, path, method = "GET", token, body) {
    return page.evaluate(
      async ({ path, method, token, body }) => {
        const res = await fetch("/api" + path, {
          method,
          headers: {
            ...(token ? { Authorization: "Bearer " + token } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, data: await res.json().catch(() => null) };
      },
      { path, method, token, body },
    );
  }
  async function token(page) {
    const session = await call(page, "/auth/browser/session", "POST");
    assert.equal(session.status, 200);
    return session.data.tokens.accessToken;
  }
  async function sheet(page) {
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
    return page.getByRole("dialog", { name: "Accounts" });
  }
  const identity = (page, name) =>
    expect(page.getByText(name, { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });
  try {
    context = await launch();
    const page = context.pages()[0];
    const password = "test-only-multi-account";
    const identities = [
      { name: "Ada Preview", email: "ada@example.test", password },
      { name: "Tunde Preview", email: "tunde@example.test", password },
    ];
    const api = await playwrightRequest.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
    });
    try {
      for (const data of identities) {
        const response = await api.post("/api/auth/register", { data });
        expect(response.status()).toBe(201);
      }
    } finally {
      await api.dispose();
    }
    await page.goto("/login?next=%2Fsettings");
    await page.locator("#login-email").fill("ada@example.test");
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await identity(page, "Ada Preview");
    const ada = await token(page);
    const address = await call(page, "/addresses", "POST", ada, {
      line1: "Ada fixture",
      city: "Awka",
      region: "Anambra",
      postalCode: "420101",
      country: "Nigeria",
    });
    assert.equal(address.status, 201);
    const tab = await context.newPage();
    await tab.goto("/settings");
    await identity(tab, "Ada Preview");
    const add = await sheet(page);
    await add.getByRole("button", { name: "Add account", exact: true }).click();
    await add.getByLabel("Email").fill("tunde@example.test");
    await add.getByLabel("Password").fill(password);
    await add.getByRole("button", { name: "Sign in and add account" }).click();
    await identity(page, "Tunde Preview");
    await identity(tab, "Tunde Preview");
    assert.equal((await call(page, "/addresses", "GET", ada)).status, 401);
    const tunde = await token(page);
    assert.deepEqual(
      (await call(page, "/addresses", "GET", tunde)).data.data,
      [],
    );
    assert.equal(
      (await call(page, "/addresses/" + address.data.data.id, "DELETE", tunde))
        .status,
      404,
    );
    await page.goto("/settings");
    await (
      await sheet(page)
    )
      .getByRole("button", { name: /^Ada Preview/ })
      .click();
    await identity(page, "Ada Preview");
    await identity(tab, "Ada Preview");
    assert.equal((await call(page, "/addresses", "GET", tunde)).status, 401);
    await context.close();
    context = await launch();
    const restored = context.pages()[0];
    await restored.goto("/settings");
    await identity(restored, "Ada Preview");
    const accounts = await sheet(restored);
    await expect(
      accounts.getByText("Tunde Preview", { exact: true }),
    ).toBeVisible();
    await accounts
      .getByRole("button", { name: "Remove Tunde Preview" })
      .click();
    await expect(
      accounts.getByText("Tunde Preview", { exact: true }),
    ).toHaveCount(0);
    await accounts
      .getByRole("button", { name: "Log out of all accounts" })
      .click();
    await expect(
      restored.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    assert.equal(
      (await call(restored, "/auth/browser/session", "POST")).status,
      401,
    );
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
