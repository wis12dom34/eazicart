import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-like-failure-test",
  source: "EAZICART",
  caption: "Reel like failure recovery",
  videoUrl: null,
  thumbnailUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='430' height='932'%3E%3Crect width='430' height='932' fill='%23111111'/%3E%3C/svg%3E",
  externalUrl: null,
  attribution: "EaziCart Demo",
  publishedAt: "2026-10-06T12:00:00.000Z",
  seller: null,
  product: null,
  _count: { likes: 12, saves: 4, views: 30, comments: 0 },
};

test("failed Like keeps state unchanged and can be retried", async ({ page }) => {
  let likeAttempts = 0;

  await page.addInitScript(() => {
    localStorage.setItem(
      "eazicart.auth.tokens",
      JSON.stringify({
        accessToken: "reels-e2e-access",
        refreshToken: "reels-e2e-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    );
  });
  await page.route(/\/users\/me(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "reels-e2e-user",
        email: "reels@example.com",
        name: "Reels Tester",
      }),
    });
  });
  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
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
    /\/reels\/reel-like-failure-test\/interactions(?:\?|$)/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { liked: false, saved: false } }),
      });
    },
  );
  await page.route(
    /\/reels\/reel-like-failure-test\/like(?:\?|$)/,
    async (route) => {
      likeAttempts += 1;
      if (likeAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "LIKE_UNAVAILABLE",
              message: "Unable to update like right now",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { liked: true, count: 13 } }),
      });
    },
  );
  await page.route(
    /\/reels\/reel-like-failure-test\/views(?:\?|$)/,
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "view-e2e",
            watchMs: 1500,
            completed: false,
            createdAt: "2026-10-06T12:00:00.000Z",
          },
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);

  const likeButton = page.getByRole("button", {
    name: "Like reel",
    exact: true,
  });
  await expect(likeButton).toBeEnabled();
  await likeButton.click();

  await expect(page.getByRole("status")).toHaveText(
    "Unable to update like right now",
  );
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(likeButton.locator("span")).toHaveText("12");
  await expect(likeButton).toBeEnabled();

  await likeButton.click();
  const unlikeButton = page.getByRole("button", {
    name: "Unlike reel",
    exact: true,
  });
  await expect(unlikeButton).toHaveAttribute("aria-pressed", "true");
  await expect(unlikeButton.locator("span")).toHaveText("13");
  expect(likeAttempts).toBe(2);
});
