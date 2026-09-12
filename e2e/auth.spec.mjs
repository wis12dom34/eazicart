import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

test("auth screens use supported credentials flows and honest validation states", async ({
  page,
  request,
}) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create account", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  await page.getByLabel("Full name").fill("Auth Customer");
  await page.getByLabel("Email address").fill("auth@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password-one");
  await page.getByLabel("Confirm password").fill("password-two");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL("http://localhost:3000/register");

  const email = `auth-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();
  const created = await request.post(`${api}/auth/register`, {
    data: { name: "Existing Customer", email, password },
  });
  expect(created.status()).toBe(201);

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Continue with Google", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Forgot password?", { exact: true })).toHaveCount(
    0,
  );

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#login-error")).toHaveText(
    "Email or password is incorrect. Try again.",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
