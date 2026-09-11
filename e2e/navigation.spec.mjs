import { test, expect } from "@playwright/test";

test("navigation matches Figma sizing and leaves products reachable", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Customer navigation" });
  await expect(nav).toHaveCSS("height", "64px");
  await expect(nav).toHaveCSS("border-radius", "24px");
  await expect(nav).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath("home.png") });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastCard = await page.locator(".product-card").last().boundingBox();
  const navBox = await nav.boundingBox();
  expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(navBox.y);
  await page.getByRole("link", { name: "Fashion", exact: true }).click();
  await expect(page).toHaveURL(/category=fashion/);
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
});
