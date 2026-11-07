import { test, expect } from "@playwright/test";
for (const variant of ["pro", "business"]) {
  const plan = variant === "pro" ? "Pro" : "Business";
  const label = `Verified ${plan} — This account has an active EaziCart ${plan} subscription.`;
  test(`${plan} membership tooltip, navigation isolation, expiry and batched refresh`, async ({
    page,
  }, info) => {
    await page.clock.install();
    let refreshes = 0;
    const badge = {
      variant: "business",
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    };
    const sellers = [
      {
        id: "business",
        userId: "u-business",
        displayName: "Business Store",
        badge,
      },
      { id: "free", userId: "u-free", displayName: "Free Store", badge: null },
      {
        id: "pro",
        userId: "u-pro",
        displayName: "Pro Store",
        badge: { ...badge, variant: "pro" },
      },
    ];
    await page.route("http://localhost:3001/**", async (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path === "/sellers") data = { data: sellers };
      else if (path === "/products")
        data = { data: [], pagination: { total: 0 } };
      else if (path === "/verification/badges") {
        refreshes++;
        data = {
          data: {
            "u-business": badge,
            "u-free": null,
            "u-pro": { ...badge, variant: "pro" },
          },
        };
      } else if (path.startsWith("/auth") || path === "/users/me")
        return route.fulfill({
          status: 401,
          headers,
          json: { error: { code: "UNAUTHORIZED", message: "Sign in" } },
        });
      await route.fulfill({ json: data, headers });
    });
    await page.goto("/search?filter=sellers");
    const trigger = page.getByRole("button", { name: label, exact: true });
    await expect(trigger).toHaveCount(1);
    const icon = trigger.locator("img");
    await expect(icon).toHaveAttribute(
      "src",
      variant === "pro"
        ? "/figma/eazicart-pro-blue-badge.svg"
        : "/figma/verified.svg",
    );
    await expect
      .poll(() => icon.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const bounds = await icon.boundingBox();
    expect(bounds.width).toBe(16);
    expect(bounds.height).toBe(16);
    await expect(
      page
        .getByRole("link", { name: "Free Store View", exact: true })
        .getByRole("button"),
    ).toHaveCount(0);
    const before = page.url();
    if (info.project.name === "desktop-chromium") {
      await trigger.hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await page.mouse.move(0, 0);
      await trigger.focus();
      await expect(page.getByRole("tooltip")).toBeVisible();
    } else {
      await trigger.tap();
      await expect(page.getByRole("tooltip")).toBeVisible();
    }
    expect(page.url()).toBe(before);
    await page.screenshot({
      path: `docs/verification-badges/screenshots/${info.project.name}-${variant}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    if (info.project.name !== "desktop-chromium") {
      await trigger.tap();
      await page
        .getByRole("heading", { name: /Search/ })
        .first()
        .tap();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
    // One scheduler handles all three accounts; no entitlement call per card.
    await page.clock.fastForward(30_100);
    await expect.poll(() => refreshes).toBe(1);
    await page.clock.fastForward(120_000);
    await expect(trigger).toHaveCount(0);
  });
}

test("a 100-account list refreshes with one entitlement batch", async ({
  page,
}) => {
  await page.clock.install();
  const badge = {
    variant: "pro",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  const sellers = Array.from({ length: 100 }, (_, i) => ({
    id: `shop-${i}`,
    userId: `account-${i}`,
    displayName: `Shop ${i}`,
    badge,
  }));
  const batches = [];
  await page.route("http://localhost:3001/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === "/sellers")
      return route.fulfill({ headers, json: { data: sellers } });
    if (path === "/products")
      return route.fulfill({
        headers,
        json: { data: [], pagination: { total: 0 } },
      });
    if (path === "/verification/badges") {
      const { accountIds } = route.request().postDataJSON();
      batches.push(accountIds);
      return route.fulfill({
        headers,
        json: { data: Object.fromEntries(accountIds.map((id) => [id, badge])) },
      });
    }
    return route.fulfill({
      status: 401,
      headers,
      json: { error: { code: "UNAUTHORIZED", message: "Sign in" } },
    });
  });
  await page.goto("/search?filter=sellers");
  const badges = page.getByRole("button", {
    name: "Verified Pro — This account has an active EaziCart Pro subscription.",
    exact: true,
  });
  await expect(badges).toHaveCount(100);
  expect(batches).toHaveLength(0);
  await page.clock.fastForward(30100);
  await expect.poll(() => batches.length).toBe(1);
  expect(new Set(batches[0]).size).toBe(100);
  await expect(badges).toHaveCount(100);
});
