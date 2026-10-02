import { expectCustomerNavigation } from "./customer-navigation.mjs";
import { test, expect } from "@playwright/test";

test("navigation matches Figma sizing and leaves products reachable", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
  const nav = await expectCustomerNavigation(page, "Home");
  await expect(nav).toHaveCSS("height", "88px");
  await expect(nav).toHaveCSS("border-radius", "0px");
  await expect(nav).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(nav.getByRole("link")).toHaveCount(5);
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath("home.png") });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastCard = await page
    .locator(".figma-home-product")
    .last()
    .boundingBox();
  const navBox = await nav.boundingBox();
  expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(navBox.y);
  await page.goto("/category/fashion");
  await expect(page).toHaveURL(/\/category\/fashion$/);
  await expect(
    page.getByRole("heading", { name: "Fashion", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
});
