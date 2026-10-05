import { expect } from "@playwright/test";

export async function expectCustomerNavigation(page, active) {
  const nav = page.getByRole("navigation", { name: "Customer navigation" });
  const labels = ["Home", "Explore", "Reels", "Cart", "Chat"];
  const hrefs = {
    Home: "/",
    Explore: "/explore",
    Reels: "/reels",
    Cart: "/cart",
    Chat: "/chat",
  };

  await expect(nav.getByRole("link")).toHaveCount(labels.length);
  for (const label of labels) {
    const item = nav.getByRole("link", { name: label, exact: true });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("href", hrefs[label]);
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
