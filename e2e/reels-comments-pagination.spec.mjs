import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-comments-pagination",
  source: "EAZICART",
  caption: "Paginated comments Reel",
  videoUrl: null,
  thumbnailUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='430' height='932'%3E%3Crect width='430' height='932' fill='%23111111'/%3E%3C/svg%3E",
  externalUrl: null,
  attribution: "EaziCart Demo",
  publishedAt: "2026-10-06T13:00:00.000Z",
  seller: null,
  product: null,
  _count: { likes: 12, saves: 4, views: 30, comments: 3 },
};

const comment = (id, body, createdAt) => ({
  id,
  reelId: reel.id,
  userId: `user-${id}`,
  body,
  createdAt,
  updatedAt: createdAt,
  user: { id: `user-${id}`, name: `User ${id}` },
});

test("older Reel comments retry without hiding the latest page or looping", async ({
  page,
}) => {
  let commentLoadAttempts = 0;

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
    /\/reels\/reel-comments-pagination\/comments(?:\?|$)/,
    async (route) => {
      commentLoadAttempts += 1;
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");

      if (!cursor) {
        expect(url.searchParams.get("limit")).toBe("30");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              comment(
                "comment-2",
                "Second newest comment",
                "2026-10-06T13:02:00.000Z",
              ),
              comment(
                "comment-3",
                "Newest comment",
                "2026-10-06T13:03:00.000Z",
              ),
            ],
            pagination: { nextCursor: "older-page", hasMore: true },
          }),
        });
        return;
      }

      expect(cursor).toBe("older-page");
      if (commentLoadAttempts === 2) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "COMMENTS_UNAVAILABLE",
              message: "Unable to load older comments right now",
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            comment("comment-1", "Oldest comment", "2026-10-06T13:01:00.000Z"),
          ],
          pagination: { nextCursor: null, hasMore: false },
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);
  await page
    .getByRole("button", { name: "Open reel comments", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Reel comments" });
  await expect(
    dialog.getByText("Second newest comment", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Newest comment", { exact: true }),
  ).toBeVisible();
  const loadOlder = dialog.getByRole("button", {
    name: "Load older comments",
    exact: true,
  });
  await expect(loadOlder).toBeEnabled();
  expect(commentLoadAttempts).toBe(1);
  await page.waitForTimeout(250);
  expect(commentLoadAttempts).toBe(1);

  await loadOlder.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Unable to load older comments right now",
  );
  await expect(
    dialog.getByText("Newest comment", { exact: true }),
  ).toBeVisible();
  const retryOlder = dialog.getByRole("button", {
    name: "Retry older comments",
    exact: true,
  });
  await expect(retryOlder).toBeEnabled();
  expect(commentLoadAttempts).toBe(2);
  await page.waitForTimeout(250);
  expect(commentLoadAttempts).toBe(2);

  await retryOlder.click();
  await expect(
    dialog.getByText("Oldest comment", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /older comments/i }),
  ).toHaveCount(0);
  expect(commentLoadAttempts).toBe(3);

  const articles = dialog.locator("article");
  await expect(articles).toHaveCount(3);
  await expect(articles.nth(0)).toContainText("Oldest comment");
  await expect(articles.nth(1)).toContainText("Second newest comment");
  await expect(articles.nth(2)).toContainText("Newest comment");
});
