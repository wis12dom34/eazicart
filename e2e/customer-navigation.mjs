import { expect } from "@playwright/test";

export async function expectCustomerNavigation(page, active) {
  const nav = page.getByRole("navigation", { name: "Customer navigation" });
  const labels = ["Home", "Explore", "Reels", "Cart", "Chat"];
  await expect(nav.getByRole("link")).toHaveCount(labels.length);
  for (const label of labels) {
    const item = nav.getByRole("link", { name: label, exact: true });
    await expect(item).toBeVisible();
    if (label === "Chat") {
      await expect(item).toHaveAttribute("aria-disabled", "true");
      await expect(item).not.toHaveAttribute("href");
    } else {
      await expect(item).toHaveAttribute(
        "href",
        {
          Home: "/",
          Explore: "/explore",
          Reels: "/reels",
          Cart: "/cart",
        }[label],
      );
    }
  }
  const selected = nav.locator('[aria-current="page"]');
  if (active) {
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAccessibleName(active);
  } else {
    await expect(selected).toHaveCount(0);
  }
  return nav;
}
