import { expect, test } from "@playwright/test";

async function anonymousSession(page) {
  for (const endpoint of [/\/users\/me(?:\?|$)/, /\/auth\/refresh(?:\?|$)/]) {
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED" } }),
      }),
    );
  }
}

function luminance(color) {
  const channels = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("shared mobile controls stay readable, tappable and keyboard accessible", async ({
  page,
}) => {
  await anonymousSession(page);
  await page.goto("/cart");
  const signIn = page.getByRole("link", { name: "Sign in", exact: true });
  await expect(signIn).toBeVisible();
  const colors = await signIn.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor];
  });
  const levels = colors.map(luminance).sort((a, b) => a - b);
  expect((levels[1] + 0.05) / (levels[0] + 0.05)).toBeGreaterThanOrEqual(4.5);

  const nav = page.getByRole("navigation", { name: "Customer navigation" });
  const labels = ["Home", "Explore", "Reels", "Cart", "Chat"];
  for (const width of [320, 393, 440]) {
    await page.setViewportSize({ width, height: 852 });
    for (const label of labels) {
      const link = nav.getByRole("link", { name: label, exact: true });
      const target = await link.boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.y + target.height).toBeLessThanOrEqual(852);
      const icon = link.locator("svg");
      await expect(icon).toHaveAttribute("aria-hidden", "true");
      await expect(icon).toHaveAttribute("focusable", "false");
    }
    const cart = nav.getByRole("link", { name: "Cart", exact: true });
    await expect(cart).toHaveAttribute("aria-current", "page");
    const iconColor = await cart
      .locator("svg")
      .evaluate((element) => getComputedStyle(element).color);
    expect(iconColor).toBe(
      await cart.evaluate((element) => getComputedStyle(element).color),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await nav.getByRole("link", { name: "Home", exact: true }).focus();
  await page.keyboard.press("Tab");
  const explore = nav.getByRole("link", { name: "Explore", exact: true });
  await expect(explore).toBeFocused();
  expect(
    await explore.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("2px");

  await page.goto("/login");
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) {
    for (const label of ["Email address", "Password"]) {
      const input = page.getByLabel(label, { exact: true });
      expect(
        await input.evaluate((element) => getComputedStyle(element).fontSize),
      ).toBe("16px");
    }
  }
});

test("shared loading indicator respects reduced motion and restores sign-in state", async ({
  page,
}) => {
  await anonymousSession(page);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(/\/users\/me(?:\?|$)/, async (route) => {
    await gate;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: "{}",
    });
  });
  try {
    await page.goto("/cart");
    const state = page.getByRole("status").filter({ hasText: "Loading…" });
    await expect(state).toBeVisible();
    const indicator = state.locator(".loading-indicator");
    await expect(indicator).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await indicator.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
    release();
    await expect(
      page.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
