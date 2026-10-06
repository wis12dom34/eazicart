import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-feed-recovery-test",
  source: "EAZICART",
  caption: "Feed recovery Reel",
  videoUrl: null,
  thumbnailUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='430' height='932'%3E%3Crect width='430' height='932' fill='%23111111'/%3E%3C/svg%3E",
  externalUrl: null,
  attribution: "EaziCart Demo",
  publishedAt: "2026-10-06T12:00:00.000Z",
  seller: null,
  product: null,
  _count: { likes: 8, saves: 2, views: 15, comments: 1 },
};

test("failed initial Reel feed can be retried without a request loop", async ({
  page,
}) => {
  let feedAttempts = 0;

  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    feedAttempts += 1;
    if (feedAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "REELS_UNAVAILABLE",
            message: "Unable to load reels right now",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [reel],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });

  await page.goto("/reels");

  const feedError = page.getByText("Unable to load reels right now", {
    exact: true,
  });
  await expect(feedError).toBeVisible();
  const retryButton = page.getByRole("button", {
    name: "Retry loading reels",
    exact: true,
  });
  await expect(retryButton).toBeVisible();
  await expect(retryButton).toBeEnabled();
  expect(feedAttempts).toBe(1);

  await page.waitForTimeout(250);
  expect(feedAttempts).toBe(1);

  await retryButton.click();

  await expect(
    page.getByRole("article", { name: "Feed recovery Reel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Feed recovery Reel", { exact: true }),
  ).toBeVisible();
  await expect(feedError).toHaveCount(0);
  await expect(retryButton).toHaveCount(0);
  expect(feedAttempts).toBe(2);
});
