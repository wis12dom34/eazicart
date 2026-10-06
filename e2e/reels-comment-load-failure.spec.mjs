import { expect, test } from "@playwright/test";

const reel = {
  id: "reel-comment-load-test",
  source: "EAZICART",
  caption: "Comment load recovery Reel",
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

test("failed comment load can be retried without showing a false empty state", async ({
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
    /\/reels\/reel-comment-load-test\/comments(?:\?|$)/,
    async (route) => {
      commentLoadAttempts += 1;
      if (commentLoadAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "COMMENTS_UNAVAILABLE",
              message: "Unable to load comments right now",
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
            {
              id: "comment-recovered",
              reelId: reel.id,
              userId: "commenter-1",
              body: "Recovered comment",
              createdAt: "2026-10-06T12:00:00.000Z",
              updatedAt: "2026-10-06T12:00:00.000Z",
              user: { id: "commenter-1", name: "Comment Tester" },
            },
          ],
        }),
      });
    },
  );

  await page.goto(`/reels?reel=${reel.id}`);
  await page
    .getByRole("button", { name: "Open reel comments", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Reel comments" });
  await expect(dialog.getByRole("alert")).toHaveText(
    "Unable to load comments right now",
  );
  await expect(
    dialog.getByText("No comments yet. Be the first.", { exact: true }),
  ).toHaveCount(0);
  const retryButton = dialog.getByRole("button", {
    name: "Retry loading comments",
    exact: true,
  });
  await expect(retryButton).toBeEnabled();
  expect(commentLoadAttempts).toBe(1);
  await page.waitForTimeout(250);
  expect(commentLoadAttempts).toBe(1);

  await retryButton.click();
  await expect(
    dialog.getByText("Recovered comment", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Comment Tester", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(retryButton).toHaveCount(0);
  expect(commentLoadAttempts).toBe(2);
});
