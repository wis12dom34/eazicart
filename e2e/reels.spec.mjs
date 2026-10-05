import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-share-test",
  source: "EAZICART",
  caption: "Shared EaziCart Reel",
  videoUrl: null,
  thumbnailUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='430' height='932'%3E%3Crect width='430' height='932' fill='%23111111'/%3E%3C/svg%3E",
  externalUrl: null,
  attribution: "EaziCart Demo",
  publishedAt: "2026-10-05T12:00:00.000Z",
  seller: null,
  product: null,
  _count: { likes: 12, saves: 4, views: 30, comments: 0 },
};

async function mockSharedReel(page) {
  let feedRequestUrl = "";
  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    feedRequestUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [reel],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });
  await page.route(
    /\/reels\/reel-share-test\/comments(?:\?|$)/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    },
  );
  return () => feedRequestUrl;
}

test("shared Reel loads the exact Reel and preserves it through sign-in", async ({
  page,
}) => {
  const feedRequestUrl = await mockSharedReel(page);

  await page.goto(`/reels?reel=${reel.id}`);

  await expect(
    page.getByRole("article", { name: reel.caption, exact: true }),
  ).toBeVisible();
  expect(feedRequestUrl()).toContain(`reelId=${reel.id}`);
  expect(feedRequestUrl()).toContain("limit=1");

  await page.getByRole("button", { name: "Like reel", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=${encodeURIComponent(`/reels?reel=${reel.id}`)}`),
  );
});

test("Reel comments dialog opens accessibly and closes with Escape", async ({
  page,
}) => {
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  await page
    .getByRole("button", { name: "Open reel comments", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Reel comments" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close comments", exact: true }),
  ).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(
    page.getByRole("button", { name: "Open reel comments", exact: true }),
  ).toBeFocused();
});

test("comments sign-in preserves the exact Reel return path", async ({
  page,
}) => {
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  await page
    .getByRole("button", { name: "Open reel comments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in to comment", exact: true })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=${encodeURIComponent(`/reels?reel=${reel.id}`)}`),
  );
});

test("Reel share uses the EaziCart deep link", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => {
        window.__eazicartSharedPayload = payload;
      },
    });
  });
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  await page.getByRole("button", { name: "Share reel", exact: true }).click();

  await expect
    .poll(() =>
      page.evaluate(() => window.__eazicartSharedPayload?.url ?? null),
    )
    .toBe(`http://localhost:3000/reels?reel=${reel.id}`);
});
