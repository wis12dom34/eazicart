import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const video = readFileSync(
  new URL("./fixtures/reel-with-audio.base64", import.meta.url),
  "utf8",
).trim();
const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="#e86921"/></svg>')}`;

for (const width of [320, 393, 430, 440]) {
  test(`Home previews actual story media and keeps compact spacing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 932 });
    let mode = "photo";
    // Only media is isolated; the catalog and seller identities use the test API.
    await page.route("**/api/social-images/profile?**", (route) =>
      route.fulfill({
        json: {
          data: {
            url: "/figma/logo.svg",
            uploadedAt: new Date().toISOString(),
          },
        },
      }),
    );
    await page.route("**/api/social-images/stories?**", (route) => {
      const ids = new URL(route.request().url()).searchParams
        .get("userIds")
        .split(",");
      const story = {
        url:
          mode === "video"
            ? `data:video/mp4;base64,${video}`
            : mode === "broken"
              ? "/qa-broken-story.jpg"
              : photo,
        contentType: mode === "video" ? "video/mp4" : "image/jpeg",
        uploadedAt: new Date().toISOString(),
      };
      return route.fulfill({
        json: {
          data:
            mode === "empty"
              ? {}
              : Object.fromEntries(ids.map((id) => [id, story])),
        },
      });
    });
    await page.route("**/qa-broken-story.jpg", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
    await page.goto("/");
    const circle = page.locator(".figma-home-story-avatar").first();
    await expect(circle.locator("img")).toHaveAttribute("src", photo);
    await expect(circle).toHaveClass(/has-story/);
    const storyLink = page.locator("a.figma-home-story").first();
    await expect(storyLink).toHaveAttribute("href", /\/story\//);
    const spacing = await page.evaluate(() => {
      const rect = (s) => document.querySelector(s).getBoundingClientRect();
      const heading = rect(".social-home-stories h2"),
        avatar = rect(".figma-home-story-avatar");
      return [
        heading.top - rect(".figma-home-tabs").bottom,
        avatar.top - heading.bottom,
        rect(".social-home-feature").top -
          rect(".figma-home-story strong").bottom,
      ];
    });
    expect(spacing[0]).toBeGreaterThanOrEqual(9);
    expect(spacing[0]).toBeLessThanOrEqual(11);
    expect(spacing[1]).toBeGreaterThanOrEqual(9);
    expect(spacing[1]).toBeLessThanOrEqual(11);
    expect(spacing[2]).toBe(12);
    expect(await circle.boundingBox()).toMatchObject({ width: 66, height: 66 });
    // Story previews do not replace seller identity in the feed.
    await expect(
      page.locator(".social-home-feature-seller img"),
    ).toHaveAttribute("src", "/figma/logo.svg");

    mode = "video";
    await page.reload();
    const preview = circle.locator("video");
    await expect(preview).toHaveAttribute("playsinline", "");
    await expect
      .poll(() =>
        preview.evaluate(
          (v) => v.readyState >= 2 && v.videoWidth > 0 && v.currentTime > 0,
        ),
      )
      .toBe(true);
    expect(await preview.boundingBox()).toMatchObject({
      width: 58,
      height: 58,
    });

    mode = "broken";
    await page.reload();
    await expect(circle.locator("img")).toHaveAttribute(
      "src",
      "/figma/logo.svg",
    );

    mode = "empty";
    await page.reload();
    await expect(circle).not.toHaveClass(/has-story/);
    await expect(circle.locator("img")).toHaveAttribute(
      "src",
      "/figma/logo.svg",
    );
    await expect(storyLink).toHaveAttribute("href", /\/seller\//);
  });
}
