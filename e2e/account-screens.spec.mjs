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
  await page.getByLabel("Confirm password").fill(password);
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

  const homeCard = page.locator(".address-card").filter({ hasText: "Home" });
  await expect(homeCard).toContainText("1 Demo Street");
  await expect(homeCard).toContainText("Near Demo Park");
  await expect(homeCard).toContainText("Lagos, Lagos 100001");
  await expect(homeCard).toContainText("Nigeria");
  await expect(homeCard.getByText("Default", { exact: true })).toBeVisible();

  await homeCard.getByRole("button", { name: "Edit" }).click();
  await homeCard.getByLabel("Address", { exact: true }).fill("2 Demo Street");
  await homeCard.getByRole("button", { name: "Save changes" }).click();
  await expect(homeCard).toContainText("2 Demo Street");

  await page.getByRole("button", { name: /Add new address/ }).click();
  await page.getByLabel("Label", { exact: true }).fill("Work");
  await page.getByLabel("Address", { exact: true }).fill("10 Market Road");
  await page.getByLabel("City", { exact: true }).fill("Lagos");
  await page.getByLabel("State / region").fill("Lagos");
  await page.getByLabel("Postal code").fill("100002");
  await page.getByLabel("Country", { exact: true }).fill("Nigeria");
  await page.getByRole("button", { name: "Save address" }).click();

  const workCard = page.locator(".address-card").filter({ hasText: "Work" });
  await expect(workCard).toContainText("10 Market Road");
  await expect(workCard.getByText("Default", { exact: true })).toHaveCount(0);
  await workCard.getByRole("button", { name: "Edit" }).click();
  await workCard.getByRole("button", { name: "Make default" }).click();
  await expect(workCard.getByText("Default", { exact: true })).toBeVisible();
  await expect(homeCard.getByText("Default", { exact: true })).toHaveCount(0);

  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");
});
