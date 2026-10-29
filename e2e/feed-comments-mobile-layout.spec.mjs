import { test, expect } from '@playwright/test';

// Run against the isolated EaziCart preview, never against production customer data.
for (const width of [320, 393, 430]) {
  test(`feed comments stay inside mobile viewport and close at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('button', { name: 'View product comments' }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Comments' });
    await expect(dialog).toBeVisible();
    const sheet = dialog.locator('.feed-comments-sheet');
    await expect(sheet).toBeVisible();
    const bounds = await sheet.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(853);
    await dialog.getByRole('button', { name: 'Close comments' }).last().click();
    await expect(dialog).toHaveCount(0);
  });
}
