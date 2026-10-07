import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const audioVideo = readFileSync(
  new URL("./fixtures/reel-with-audio.base64", import.meta.url),
  "utf8",
).trim();

test("Reel sound can be enabled by a tap and muted again", async ({ page }) => {
  await page.route(/\/reels\/feed(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "sound-reel",
            source: "EAZICART",
            caption: "Audio test",
            videoUrl: `data:video/mp4;base64,${audioVideo}`,
            seller: null,
            product: null,
            _count: { likes: 0, saves: 0, views: 0, comments: 0 },
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      },
    }),
  );
  await page.goto("/reels?reel=sound-reel");
  const video = page.locator("video");
  await expect
    .poll(() => video.evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await expect(video).toHaveJSProperty("muted", true);
  await page
    .getByRole("button", { name: "Turn Reel sound on", exact: true })
    .click();
  await expect(video).toHaveJSProperty("muted", false);
  await expect(video).toHaveJSProperty("paused", false);
  await expect(
    page.getByRole("button", { name: "Turn Reel sound off", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Turn Reel sound off", exact: true })
    .click();
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("paused", false);
});
