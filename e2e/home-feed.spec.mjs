import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const web = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3000";
import { expectCustomerNavigation } from "./customer-navigation.mjs";

test("Home saves and supported seller/cart actions persist through the real API", async ({
  page,
}) => {
  // Profile-image storage is external to this PostgreSQL customer-flow test.
  // Avoid calling Vercel Blob without credentials; seller/cart/API remain real.
  await page.route("**/api/social-images/profile?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    }),
  );
  const email = `home-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Home Feed Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${web}/`);

  const product = page
    .locator(".figma-home-product")
    .filter({ hasText: "Woven everyday tote" });
  await expect(product).toBeVisible();
  await product
    .getByRole("button", { name: "Save Woven everyday tote", exact: true })
    .click();
  await expect(
    product.getByRole("button", {
      name: "Unsave Woven everyday tote",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    product.getByRole("button", {
      name: "Unsave Woven everyday tote",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await product
    .getByRole("link", { name: "View Woven everyday tote", exact: true })
    .click();
  await expect(page).toHaveURL(/\/product\/demo-product-woven-tote$/);
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to cart");
  await page.getByRole("link", { name: /View .* seller profile/ }).click();
  await expect(page).toHaveURL(/\/seller\/demo-seller-lagos-studio$/);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();

  await page.goto("/following");
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Saved sections" })
      .getByText("Sellers", { exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "Saved sections" })
      .getByText("Recommended", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Followed sellers").getByText(/^\d+ followers?$/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unfollow Lagos Studio", exact: true }),
  ).toBeVisible();
  await expectCustomerNavigation(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfollow Lagos Studio", exact: true }),
  ).toBeVisible();

  await page.goto("/cart");
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quantity span")).toHaveText("1");
  await expect(
    page.getByText("Total", { exact: true }).locator(".."),
  ).toContainText("18,500");
  await expectCustomerNavigation(page, "Cart");
});

for (const width of [320, 393, 430, 440]) {
  test(`Home profile photos stay circular with portrait uploads at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 932 });
    // Isolated photo fixture; products and seller identities use the real test API.
    const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1200"><rect width="400" height="1200" fill="#935c39"/></svg>')}`;
    await page.route("**/api/social-images/profile?**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { url: photo, uploadedAt: new Date().toISOString() },
        }),
      }),
    );
    await page.goto("/");
    for (const selector of [
      ".social-home-feature-seller > span",
      ".social-home-editorial-header > span",
      ".social-home-seller > span",
      ".figma-home-story-media",
    ]) {
      const avatars = page.locator(selector);
      await expect(avatars.first().locator("img")).toHaveAttribute(
        "src",
        photo,
      );
      await expect
        .poll(() =>
          avatars.evaluateAll((elements) =>
            elements.every((element) => {
              const image = element.querySelector("img");
              if (!image?.complete || !image.naturalWidth) return false;
              const frame = element.getBoundingClientRect();
              const bounds = image.getBoundingClientRect();
              return (
                Math.abs(bounds.width - bounds.height) < 1 &&
                bounds.left >= frame.left - 1 &&
                bounds.right <= frame.right + 1 &&
                bounds.top >= frame.top - 1 &&
                bounds.bottom <= frame.bottom + 1 &&
                getComputedStyle(image).objectFit === "cover"
              );
            }),
          ),
        )
        .toBe(true);
    }
    const post = page.locator(".social-home-editorial");
    const avatar = await post
      .locator(".social-home-editorial-header > span img")
      .boundingBox();
    const copy = await post.locator(":scope > p").boundingBox();
    expect(avatar.y + avatar.height).toBeLessThanOrEqual(copy.y);
    // Profile fixtures never replace catalog imagery.
    await expect(
      post.locator(".social-home-editorial-media > img"),
    ).not.toHaveAttribute("src", photo);

    const sellerHref = await page
      .locator(".social-home-feature-seller")
      .getAttribute("href");
    await page.goto(sellerHref);
    const profilePhoto = page.locator('img[src^="data:image/svg+xml"]').first();
    await expect(profilePhoto).toHaveAttribute("src", photo);
    await expect
      .poll(() =>
        profilePhoto.evaluate((image) => {
          const bounds = image.getBoundingClientRect();
          const frame = image.parentElement.getBoundingClientRect();
          return (
            Math.abs(bounds.width - bounds.height) < 1 &&
            bounds.height <= frame.height
          );
        }),
      )
      .toBe(true);
    await page.getByRole("link", { name: "Message", exact: true }).click();
    const chatPhotos = page.locator(
      ".eazicart-chat-store-avatar img, .eazicart-chat-start-avatar img",
    );
    await expect(chatPhotos.first()).toHaveAttribute("src", photo);
    await expect
      .poll(() =>
        chatPhotos.evaluateAll(
          (images) =>
            images.length === 2 &&
            images.every((image) => {
              const bounds = image.getBoundingClientRect();
              const frame = image.parentElement.getBoundingClientRect();
              return (
                Math.abs(bounds.width - bounds.height) < 1 &&
                bounds.height <= frame.height
              );
            }),
        ),
      )
      .toBe(true);
  });
}
