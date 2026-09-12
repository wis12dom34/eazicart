import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("edit profile and address book use real supported account data", async ({
  page,
}) => {
  const email = `account-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Account Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/edit-profile");
  await expect(
    page.getByRole("heading", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change photo" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Username")).toBeDisabled();
  await expect(page.getByLabel("Username")).toHaveValue("Not available yet");
  await expect(page.getByLabel("Phone number")).toBeDisabled();
  await expect(page.getByLabel("Phone number")).toHaveValue(
    "Not available yet",
  );
  await expect(page.getByLabel("Email address")).toBeDisabled();
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Full name").fill("Updated Account Customer");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL("http://localhost:3000/profile");
  await expect(
    page.getByRole("heading", {
      name: "Updated Account Customer",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("/address-book");
  await expect(
    page.getByRole("heading", { name: "Address Book", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Add new address/ }).click();
  await page.getByLabel("Label", { exact: true }).fill("Home");
  await page.getByLabel("Address", { exact: true }).fill("1 Demo Street");
  await page.getByLabel("Address line 2").fill("Near Demo Park");
  await page.getByLabel("City", { exact: true }).fill("Lagos");
  await page.getByLabel("State / region").fill("Lagos");
  await page.getByLabel("Postal code").fill("100001");
  await page.getByLabel("Country", { exact: true }).fill("Nigeria");
  await page.getByRole("button", { name: "Save address" }).click();

  const addressCard = page.locator(".address-card").first();
  await expect(addressCard).toContainText("Home");
  await expect(addressCard).toContainText("1 Demo Street");
  await expect(addressCard).toContainText("Near Demo Park");
  await expect(addressCard).toContainText("Lagos, Lagos 100001");
  await expect(addressCard).toContainText("Nigeria");

  await addressCard.getByRole("button", { name: "Edit" }).click();
  await addressCard
    .getByLabel("Address", { exact: true })
    .fill("2 Demo Street");
  await addressCard.getByRole("button", { name: "Save changes" }).click();
  await expect(addressCard).toContainText("2 Demo Street");

  await addressCard.getByRole("button", { name: "Edit" }).click();
  await addressCard.getByRole("button", { name: "Make default" }).click();
  await expect(addressCard.getByText("Default", { exact: true })).toBeVisible();

  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");
});
