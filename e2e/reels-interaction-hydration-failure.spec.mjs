import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-interaction-hydration-test",
  source: "EAZICART",
  caption: "Reel interaction state recovery",
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

test("failed interaction hydration stays locked until manual retry recovers state", async ({
  page,
}) => {
  let interactionAttempts = 0;
  let mutationAttempts = 0;

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
    /\/reels\/reel-interaction-hydration-test\/interactions(?:\?|$)/,
    async (route) => {
      interactionAttempts += 1;
      if (interactionAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "INTERACTIONS_UNAVAILABLE",
              message: "Unable to load Reel actions right now",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { liked: true, saved: true } }),
      });
    },
  );
  await page.route(
    /\/reels\/reel-interaction-hydration-test\/(?:like|save)(?:\?|$)/,
    async (route) => {
      mutationAttempts += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "UNEXPECTED_MUTATION",
            message: "Unexpected mutation",
          },
        }),
      });
    },
  );
  await page.route(
    /\/reels\/reel-interaction-hydration-test\/views(?:\?|$)/,
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
  const saveButton = page.getByRole("button", {
    name: "Save reel",
    exact: true,
  });
  const retryButton = page.getByRole("button", {
    name: "Retry Reel actions",
    exact: true,
  });

  await expect(retryButton).toContainText(
    "Unable to load Reel actions right now. Tap to retry.",
  );
  await expect(likeButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
  expect(interactionAttempts).toBe(1);
  expect(mutationAttempts).toBe(0);
  await page.waitForTimeout(250);
  expect(interactionAttempts).toBe(1);
  expect(mutationAttempts).toBe(0);

  await retryButton.click();

  const unlikeButton = page.getByRole("button", {
    name: "Unlike reel",
    exact: true,
  });
  const unsaveButton = page.getByRole("button", {
    name: "Remove saved reel",
    exact: true,
  });
  await expect(unlikeButton).toBeEnabled();
  await expect(unlikeButton).toHaveAttribute("aria-pressed", "true");
  await expect(unsaveButton).toBeEnabled();
  await expect(unsaveButton).toHaveAttribute("aria-pressed", "true");
  await expect(retryButton).toHaveCount(0);
  expect(interactionAttempts).toBe(2);
  expect(mutationAttempts).toBe(0);
});
