import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 375, height: 812 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`Subscription purchase controls fit at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/seller/subscription?plan=PRO");
    const upgrade = page.getByRole("link", {
      name: "Upgrade to Pro",
      exact: true,
    });
    await expect(upgrade).toBeInViewport();
    const footer = await page.locator("footer").boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
    const benefits = page.getByRole("region", {
      name: "Pro plan benefits",
      exact: true,
    });
    await benefits.press("End");
    await expect(
      benefits.getByText("Dedicated seller support", { exact: true }),
    ).toBeInViewport();
    await expect(upgrade).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.getByRole("tab", { name: "Basic", exact: true }).click();
    const basic = page.getByRole("link", {
      name: "Start selling for free",
      exact: true,
    });
    await expect(basic).toBeInViewport();
    await expect(basic).toHaveAttribute(
      "href",
      /seller%2Fdashboard|\/seller\/dashboard/,
    );
    await page.getByRole("tab", { name: "Business", exact: true }).click();
    const business = page.getByRole("button", {
      name: "Business coming soon",
      exact: true,
    });
    await expect(business).toBeDisabled();
    await expect(business).toBeInViewport();
  });
}

test("Subscription purchase remains reachable in a short viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 540 });
  await page.goto("/seller/subscription?plan=PRO");
  const upgrade = page.getByRole("link", {
    name: "Upgrade to Pro",
    exact: true,
  });
  await upgrade.scrollIntoViewIfNeeded();
  await expect(upgrade).toBeInViewport();
  await expect(
    page.getByRole("region", { name: "Pro plan benefits", exact: true }),
  ).toHaveAttribute("tabindex", "0");
});
