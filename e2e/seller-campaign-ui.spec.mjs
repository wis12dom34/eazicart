import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("seller can create a real product-backed campaign draft from the workspace", async ({
  page,
}) => {
  const email = `campaign-ui-${randomUUID()}@eazicart.invalid`;
  const password = `campaign-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Campaign UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await expect(
    page.getByRole("heading", { name: "Start selling on EaziCart" }),
  ).toBeVisible();
  await page.getByLabel("Store name").fill("Campaign UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();

  await expect(
    page.getByRole("heading", { name: "Campaign UI Store", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Campaigns/ })).toHaveAttribute(
    "href",
    "/seller/campaigns",
  );

  await page.goto("/seller/products");
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Product name").fill("Campaign test tote");
  await page.getByLabel("Price (NGN)").fill("38500");
  await page.getByLabel("Stock").fill("12");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(
    page.getByText("Campaign test tote", { exact: true }),
  ).toBeVisible();

  await page.goto("/seller/campaigns");
  await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
  await expect(
    page.getByText("Campaign delivery is not configured yet"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create campaign" }),
  ).toHaveAttribute("href", "/seller/campaigns/new");

  await page.getByRole("link", { name: "Create campaign" }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/campaigns/new");
  await expect(page.getByLabel("Product")).toContainText("Campaign test tote");
  await page.getByLabel("Campaign name").fill("New season tote push");
  await page.getByLabel("More orders").check();
  await expect(page.getByLabel("Country")).toHaveValue("Nigeria");
  await expect(page.getByLabel("Minimum age")).toHaveValue("18");
  await expect(page.getByLabel("Maximum age")).toHaveValue("44");
  await expect(page.getByLabel("Daily budget (NGN)")).toHaveValue("5000");
  await expect(page.getByLabel("Duration (days)")).toHaveValue("7");

  await page.getByRole("button", { name: "Save campaign draft" }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/campaigns");
  await expect(
    page.getByText("New season tote push", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("More orders", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Performance not available yet")).toBeVisible();
});
