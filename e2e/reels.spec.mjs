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
  await page.route(/\/auth\/refresh(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tokens: {
          accessToken: "reels-e2e-access",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      }),
    }),
  );
  await page.route(/\/users\/me(?:\?|$)/, async (route) => {
    const authenticated =
      (await route.request().allHeaders())["authorization"] ===
      "Bearer reels-e2e-access";
    await route.fulfill({
      status: authenticated ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        authenticated
          ? {
              id: "reels-e2e-user",
              email: "reels@example.com",
              name: "Reels Tester",
            }
          : { error: { code: "UNAUTHORIZED" } },
      ),
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

test("authenticated Reel records a view after the watch threshold", async ({
  page,
}) => {
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
  await page.route(/\/reels\/reel-share-test\/views(?:\?|$)/, async (route) => {
    viewRequests.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
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

  await expect.poll(() => viewRequests.length, { timeout: 4000 }).toBe(1);
  expect(viewRequests[0]).toEqual({
    method: "POST",
    body: { watchMs: 1500, completed: false },
  });
  await page.waitForTimeout(250);
  expect(viewRequests).toHaveLength(1);
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
    page.getByText("This Reel is unavailable.", { exact: true }),
  ).toBeVisible();
  expect(feedRequestUrl).toContain("reelId=missing-reel");
  expect(feedRequestUrl).toContain("limit=1");
  expect(legacyProductsRequested).toBe(false);
});

test("Reel comments dialog opens accessibly and closes with Escape", async ({
  page,
}) => {
  await mockSharedReel(page);
  let releaseComments;
  const commentsReady = new Promise((resolve) => {
    releaseComments = resolve;
  });
  await page.route(
    /\/reels\/reel-share-test\/comments(?:\?|$)/,
    async (route) => {
      await commentsReady;
      await route.fulfill({ json: { data: [] } });
    },
  );
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
  await expect(
    page.getByText("Loading comments…", { exact: true }),
  ).toBeVisible();
  await expect(signInButton).toHaveCount(0);
  releaseComments();
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

test("authenticated Reel posts a comment and updates the count", async ({
  page,
}) => {
  const postedBodies = [];

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
  await page.route(
    /\/reels\/reel-share-test\/comments(?:\?|$)/,
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      postedBodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "comment-e2e",
            reelId: reel.id,
            userId: "reels-e2e-user",
            body: "Great product",
            createdAt: "2026-10-05T12:00:00.000Z",
            updatedAt: "2026-10-05T12:00:00.000Z",
            user: { id: "reels-e2e-user", name: "Reels Tester" },
          },
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);
  const commentsButton = page.getByRole("button", {
    name: "Open reel comments",
    exact: true,
  });
  await commentsButton.click();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("  Great product  ");
  await page.getByRole("button", { name: "Post", exact: true }).click();

  await expect(page.getByText("Great product", { exact: true })).toBeVisible();
  expect(postedBodies).toEqual([{ body: "Great product" }]);
  await page
    .getByRole("button", { name: "Close comments", exact: true })
    .click();
  await expect(commentsButton.locator("span")).toHaveText("1");
});

test("failed comment post keeps the draft and count unchanged", async ({
  page,
}) => {
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
  await page.route(
    /\/reels\/reel-share-test\/comments(?:\?|$)/,
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "COMMENT_UNAVAILABLE",
            message: "Unable to post comment right now",
          },
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);
  const commentsButton = page.getByRole("button", {
    name: "Open reel comments",
    exact: true,
  });
  await commentsButton.click();
  const commentInput = page.getByRole("textbox", {
    name: "Comment",
    exact: true,
  });
  await commentInput.fill("Keep this draft");
  await page.getByRole("button", { name: "Post", exact: true }).click();

  await expect(
    page.getByRole("dialog", { name: "Reel comments" }).getByRole("alert"),
  ).toHaveText("Unable to post comment right now");
  await expect(commentInput).toHaveValue("Keep this draft");
  await expect(
    page.getByRole("button", { name: "Post", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Close comments", exact: true })
    .click();
  await expect(commentsButton.locator("span")).toHaveText("0");
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
  const origin = await page.evaluate(() => window.location.origin);
  await expect
    .poll(() => page.evaluate(() => window.__eazicartCopiedReelUrl ?? null))
    .toBe(`${origin}/reels?reel=${reel.id}`);
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

  const origin = await page.evaluate(() => window.location.origin);
  await expect
    .poll(() =>
      page.evaluate(() => window.__eazicartSharedPayload?.url ?? null),
    )
    .toBe(`${origin}/reels?reel=${reel.id}`);
});

const layoutReel = {
  ...reel,
  seller: {
    id: "layout-seller-profile",
    userId: "layout-seller-user",
    displayName: "Wick Store",
  },
  caption:
    "Everyday essentials, ready to shop. A longer caption stays clear of the action rail.",
  product: {
    id: "layout-product",
    name: "Everyday essentials",
    price: "12500",
    images: [],
  },
};

async function mockLayoutReel(page, authenticated = false) {
  await mockSharedReel(page);
  await page.route(/\/reels\/feed(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [layoutReel],
        pagination: { nextCursor: null, hasMore: false },
      }),
    }),
  );
  await page.route(/\/users\/me(?:\?|$)/, (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        authenticated
          ? { id: "layout-viewer", name: "Viewer", email: "viewer@example.com" }
          : { error: { code: "UNAUTHORIZED" } },
      ),
    }),
  );
  await page.route(/\/auth\/refresh(?:\?|$)/, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route(/\/reels\/reel-share-test\/interactions(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { liked: false, saved: false } }),
    }),
  );
}

test("Reel creator and actions align above navigation at mobile widths", async ({
  page,
}, testInfo) => {
  await mockLayoutReel(page);
  await page.goto(`/reels?reel=${reel.id}`);
  const article = page.getByRole("article", {
    name: layoutReel.caption,
    exact: true,
  });
  const rail = article.locator('[aria-label="Reel actions"]');
  const avatar = rail.getByRole("link", {
    name: "View Wick Store seller profile",
  });
  await expect(avatar).toHaveAttribute("href", "/seller/layout-seller-profile");
  const follow = rail.getByRole("button", {
    name: "Follow Wick Store",
    exact: true,
  });
  await expect(follow).toBeEnabled();
  for (const name of ["Back to home", "Search products"]) {
    const icon = page.getByRole("link", { name, exact: true }).locator("svg");
    expect(
      await icon.evaluate((element) => getComputedStyle(element).color),
    ).toBe("rgb(255, 255, 255)");
  }
  const labels = [
    "Like reel",
    "Open reel comments",
    "Save reel",
    "Share reel",
    "Open cart",
  ];
  await expect(rail.locator(":scope > button, :scope > a")).toHaveCount(5);

  for (const width of [320, 375, 393, 440]) {
    await page.setViewportSize({ width, height: 852 });
    const avatarBox = await avatar.boundingBox();
    const railBox = await rail.boundingBox();
    const center = avatarBox.x + avatarBox.width / 2;
    expect(avatarBox.width).toBe(48);
    expect(width - railBox.x - railBox.width).toBeCloseTo(16, 0);
    let previousBottom = avatarBox.y + avatarBox.height;
    for (const [index, label] of labels.entries()) {
      const action = rail.locator(":scope > button, :scope > a").nth(index);
      await expect(action).toHaveAttribute("aria-label", label);
      const box = await action.boundingBox();
      const icon = await action.locator("i").boundingBox();
      const count = await action.locator("span, small").boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width / 2).toBeCloseTo(center, 1);
      expect(icon.x + icon.width / 2).toBeCloseTo(center, 1);
      expect(count.x + count.width / 2).toBeCloseTo(center, 1);
      expect(count.y).toBeGreaterThanOrEqual(icon.y + icon.height);
      expect(box.y).toBeGreaterThan(previousBottom);
      previousBottom = box.y + box.height;
    }
    const badge = await follow.boundingBox();
    expect(badge.width).toBeGreaterThanOrEqual(44);
    expect(badge.height).toBeGreaterThanOrEqual(44);
    expect(badge.x + badge.width / 2).toBeCloseTo(center, 1);
    const nav = await page
      .getByRole("navigation", { name: "Customer navigation" })
      .boundingBox();
    expect(previousBottom).toBeLessThan(nav.y);
    const details = await article
      .getByRole("link", { name: "Wick Store", exact: true })
      .locator("..")
      .boundingBox();
    expect(details.x + details.width).toBeLessThan(railBox.x);
    expect(details.y + details.height).toBeLessThan(nav.y);
    await expect(
      page.getByRole("link", { name: "Reels", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (width === 393) {
      await testInfo.attach("reels-393x852", {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
  }
  await follow.click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=${encodeURIComponent(`/reels?reel=${reel.id}`)}`),
  );
});

test("Reel follow badge reuses seller follow and restores followed state", async ({
  page,
}) => {
  await mockLayoutReel(page, true);
  let followed = false;
  const methods = [];
  await page.route(/\/following(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: followed ? [{ sellerId: layoutReel.seller.userId }] : [],
      }),
    }),
  );
  await page.route(/\/sellers\/layout-seller-user\/follow(?:\?|$)/, (route) => {
    methods.push(route.request().method());
    followed = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(`/reels?reel=${reel.id}`);
  const follow = page.getByRole("button", {
    name: "Follow Wick Store",
    exact: true,
  });
  await expect(follow).toBeEnabled();
  await follow.click();
  await expect(follow).toHaveCount(0);
  expect(methods).toEqual(["POST"]);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "View Wick Store seller profile" }),
  ).toBeVisible();
  await expect(follow).toHaveCount(0);
});
