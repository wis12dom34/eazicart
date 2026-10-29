import { test, expect } from '@playwright/test';

// Layout-only regression: never submits comments or changes customer records.
for (const [label, start, rotated] of [
  ['small', { width: 393, height: 852 }, { width: 852, height: 393 }],
  ['large', { width: 430, height: 932 }, { width: 932, height: 430 }],
]) {
  test(`comments recover after viewport rotation — ${label}`, async ({ page }) => {
    await page.setViewportSize(start);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'View product comments' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Comments' });
    const sheet = dialog.locator('.feed-comments-sheet');
    await expect(sheet).toBeVisible();
    for (const size of [rotated, start]) {
      await page.setViewportSize(size);
      await expect.poll(async () => {
        const r = await sheet.boundingBox();
        return !!r && r.x >= -1 && r.y >= -1 && r.x + r.width <= size.width + 1 && r.y + r.height <= size.height + 1;
      }, { timeout: 2000, intervals: [100, 150, 250] }).toBe(true);
    }
    await dialog.getByRole('button', { name: 'Close comments' }).last().click();
    await expect(dialog).toHaveCount(0);
  });
}
