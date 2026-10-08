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

test("failed Like keeps state unchanged and can be retried", async ({
  page,
}) => {
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

test("failed Save keeps state unchanged and can be retried", async ({
  page,
}) => {
  let saveAttempts = 0;

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
    /\/reels\/reel-like-failure-test\/save(?:\?|$)/,
    async (route) => {
      saveAttempts += 1;
      if (saveAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "SAVE_UNAVAILABLE",
              message: "Unable to update save right now",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { saved: true, count: 5 } }),
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

  const saveButton = page.getByRole("button", {
    name: "Save reel",
    exact: true,
  });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(page.getByRole("status")).toHaveText(
    "Unable to update save right now",
  );
  await expect(saveButton).toHaveAttribute("aria-pressed", "false");
  await expect(saveButton.locator("small")).toHaveText("4");
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  const unsaveButton = page.getByRole("button", {
    name: "Remove saved reel",
    exact: true,
  });
  await expect(unsaveButton).toHaveAttribute("aria-pressed", "true");
  await expect(unsaveButton.locator("small")).toHaveText("5");
  expect(saveAttempts).toBe(2);
});

test("failed Like replaces an earlier Share status", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "eazicart.auth.tokens",
      JSON.stringify({
        accessToken: "reels-e2e-access",
        refreshToken: "reels-e2e-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    );
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
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
  await page.getByRole("button", { name: "Share reel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Reel link copied");

  const likeButton = page.getByRole("button", {
    name: "Like reel",
    exact: true,
  });
  await likeButton.click();

  await expect(page.getByRole("status")).toHaveText(
    "Unable to update like right now",
  );
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(likeButton.locator("span")).toHaveText("12");
});

test("failed Reel view recording retries once", async ({ page }) => {
  const viewRequests = [];

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
    /\/reels\/reel-like-failure-test\/views(?:\?|$)/,
    async (route) => {
      viewRequests.push({
        method: route.request().method(),
        body: route.request().postDataJSON(),
      });
      if (viewRequests.length === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "VIEW_UNAVAILABLE",
              message: "Unable to record view right now",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "view-e2e-retry",
            watchMs: 1500,
            completed: false,
            createdAt: "2026-10-06T12:00:00.000Z",
          },
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);

  await expect.poll(() => viewRequests.length, { timeout: 5000 }).toBe(2);
  expect(viewRequests).toEqual([
    { method: "POST", body: { watchMs: 1500, completed: false } },
    { method: "POST", body: { watchMs: 1500, completed: false } },
  ]);
  await page.waitForTimeout(250);
  expect(viewRequests).toHaveLength(2);
});

test("failed Reel pagination can be retried without a request loop", async ({
  page,
}) => {
  let paginationAttempts = 0;
  const pageOne = [1, 2, 3].map((number) => ({
    ...reel,
    id: `reel-pagination-${number}`,
    caption: `Pagination Reel ${number}`,
  }));
  const pageTwo = {
    ...reel,
    id: "reel-pagination-4",
    caption: "Pagination Reel 4",
  };

  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    if (!cursor) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: pageOne,
          pagination: { nextCursor: "page-2", hasMore: true },
        }),
      });
      return;
    }

    paginationAttempts += 1;
    if (paginationAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "FEED_UNAVAILABLE",
            message: "Unable to load more reels right now",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [pageTwo],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });

  await page.goto("/reels");
  await expect(
    page.getByRole("article", { name: "Pagination Reel 1" }),
  ).toBeVisible();
  await page
    .getByRole("article", { name: "Pagination Reel 3" })
    .scrollIntoViewIfNeeded();

  const retryButton = page.getByRole("button", {
    name: "Unable to load more reels right now. Tap to retry.",
  });
  await expect(retryButton).toBeVisible();
  expect(paginationAttempts).toBe(1);
  await page.waitForTimeout(250);
  expect(paginationAttempts).toBe(1);

  await retryButton.click();
  await expect(
    page.getByRole("article", { name: "Pagination Reel 4" }),
  ).toHaveCount(1);
  await expect(retryButton).toHaveCount(0);
  expect(paginationAttempts).toBe(2);
});
