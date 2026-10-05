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

test("save sign-in preserves the exact Reel return path", async ({ page }) => {
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  await page.getByRole("button", { name: "Save reel", exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=${encodeURIComponent(`/reels?reel=${reel.id}`)}`),
  );
});

test("authenticated Reel hydrates liked and saved state", async ({ page }) => {
  let interactionsAuthorization = "";
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
  await page.route(
    /\/reels\/reel-share-test\/interactions(?:\?|$)/,
    async (route) => {
      interactionsAuthorization =
        (await route.request().allHeaders())["authorization"] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { liked: true, saved: true } }),
      });
    },
  );
  await mockSharedReel(page);

  await page.goto(`/reels?reel=${reel.id}`);

  const unlikeButton = page.getByRole("button", {
    name: "Unlike reel",
    exact: true,
  });
  const unsaveButton = page.getByRole("button", {
    name: "Remove saved reel",
    exact: true,
  });
  await expect(unlikeButton).toHaveAttribute("aria-pressed", "true");
  await expect(unsaveButton).toHaveAttribute("aria-pressed", "true");
  expect(interactionsAuthorization).toBe("Bearer reels-e2e-access");
});

test("authenticated Reel toggles like and save through existing routes", async ({
  page,
}) => {
  const likeMethods = [];
  const saveMethods = [];

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
  await page.route(
    /\/reels\/reel-share-test\/interactions(?:\?|$)/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { liked: false, saved: false } }),
      });
    },
  );
  await page.route(/\/reels\/reel-share-test\/like(?:\?|$)/, async (route) => {
    const method = route.request().method();
    likeMethods.push(method);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { liked: method === "POST", count: method === "POST" ? 13 : 12 },
      }),
    });
  });
  await page.route(/\/reels\/reel-share-test\/save(?:\?|$)/, async (route) => {
    const method = route.request().method();
    saveMethods.push(method);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { saved: method === "POST", count: method === "POST" ? 5 : 4 },
      }),
    });
  });
  await page.route(/\/reels\/reel-share-test\/views(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "view-e2e",
          watchMs: 1500,
          completed: false,
          createdAt: "2026-10-05T12:00:00.000Z",
        },
      }),
    });
  });
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  const likeButton = page.getByRole("button", {
    name: "Like reel",
    exact: true,
  });
  const saveButton = page.getByRole("button", {
    name: "Save reel",
    exact: true,
  });
  await expect(likeButton).toBeEnabled();
  await expect(saveButton).toBeEnabled();

  await likeButton.click();
  const unlikeButton = page.getByRole("button", {
    name: "Unlike reel",
    exact: true,
  });
  await expect(unlikeButton).toHaveAttribute("aria-pressed", "true");
  await expect(unlikeButton.locator("span")).toHaveText("13");
  await unlikeButton.click();
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(likeButton.locator("span")).toHaveText("12");

  await saveButton.click();
  const unsaveButton = page.getByRole("button", {
    name: "Remove saved reel",
    exact: true,
  });
  await expect(unsaveButton).toHaveAttribute("aria-pressed", "true");
  await expect(unsaveButton.locator("small")).toHaveText("5");
  await unsaveButton.click();
  await expect(saveButton).toHaveAttribute("aria-pressed", "false");
  await expect(saveButton.locator("small")).toHaveText("4");

  expect(likeMethods).toEqual(["POST", "DELETE"]);
  expect(saveMethods).toEqual(["POST", "DELETE"]);
});

test("missing shared Reel does not fall back to legacy products", async ({
  page,
}) => {
  let feedRequestUrl = "";
  let legacyProductsRequested = false;
  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    feedRequestUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });
  await page.route(/\/products(?:\?|$)/, async (route) => {
    legacyProductsRequested = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.goto("/reels?reel=missing-reel");

  await expect(
    page.getByText("No reels have been published yet.", { exact: true }),
  ).toBeVisible();
  expect(feedRequestUrl).toContain("reelId=missing-reel");
  expect(feedRequestUrl).toContain("limit=1");
  expect(legacyProductsRequested).toBe(false);
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

  const signInButton = page.getByRole("button", {
    name: "Sign in to comment",
    exact: true,
  });
  await expect(signInButton).toBeEnabled();
  await page.keyboard.press("Shift+Tab");
  await expect(signInButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close comments", exact: true }),
  ).toBeFocused();

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

test("Reel share copies the deep link when native share is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__eazicartCopiedReelUrl = value;
        },
      },
    });
  });
  await mockSharedReel(page);
  await page.goto(`/reels?reel=${reel.id}`);

  await page.getByRole("button", { name: "Share reel", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText("Reel link copied");
  await expect
    .poll(() => page.evaluate(() => window.__eazicartCopiedReelUrl ?? null))
    .toBe(`http://localhost:3000/reels?reel=${reel.id}`);
});

test("Reel share keeps external-source Reels inside EaziCart", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => {
        window.__eazicartSharedPayload = payload;
      },
    });
  });
  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            ...reel,
            source: "TIKTOK",
            externalUrl: "https://www.tiktok.com/@demo/video/123",
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });
  await page.goto(`/reels?reel=${reel.id}`);

  await page.getByRole("button", { name: "Share reel", exact: true }).click();

  await expect
    .poll(() =>
      page.evaluate(() => window.__eazicartSharedPayload?.url ?? null),
    )
    .toBe(`http://localhost:3000/reels?reel=${reel.id}`);
});
