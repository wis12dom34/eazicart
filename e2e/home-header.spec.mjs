import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 375, height: 812 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`Home header stays pinned when collapsed at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".social-home-feed")).toBeVisible();
    const header = page.locator(".social-home-sticky");
    const search = page.locator(".figma-home-search");
    await expect(search).toBeVisible();
    await expect(page.locator(".figma-home-compact-search")).toHaveCount(0);

    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 800);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(72);
    await expect(page.locator(".social-home")).toHaveClass(
      /home-header-collapsed/,
    );
    await expect(search).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Search", exact: true }),
    ).toBeVisible();
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    // Check the reverse transition too, not just the class change on scroll down.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".social-home")).not.toHaveClass(
      /home-header-collapsed/,
    );
    await expect(search).toBeVisible();
    await expect(page.locator(".figma-home-compact-search")).toHaveCount(0);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });
}
