import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Isolated DOM/CSS fixture: no authentication, network writes, or customer data.
// Resizing the viewport is NOT an emulation of a physical iOS keyboard.
const css = readFileSync(fileURLToPath(new URL('./fixtures/mobile-comments.css', import.meta.url)), 'utf8');

// Fail explicitly when the target branch does not contain the comments sheet styles.
// Do not make the synthetic fixture pass by substituting unrelated test-only CSS.
test('mobile comments sheet styles are present in the tested branch', () => {
  for (const selector of ['.feed-comments-layer', '.feed-comments-sheet', '.feed-comments-list']) {
    expect(css, `Missing ${selector} in mobile-comments.css`).toContain(selector);
  }
});

for (const width of [320, 393, 430]) {
  test(`comments composer preserves draft and scroll after simulated keyboard dismissal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>${css}</style>
      <div class="feed-comments-layer" role="dialog" aria-label="Comments">
        <section class="feed-comments-sheet">
          <header><button type="button" aria-label="Close comments">Close</button><strong>Comments</strong></header>
          <div class="feed-comments-list">${Array.from({length:65},(_,i) => `<article style="padding:12px">Comment ${i} ${'discussion '.repeat(20)}</article>`).join('')}</div>
          <form onsubmit="return false"><span class="feed-comment-avatar">U</span>
            <div class="feed-comments-composer"><div class="feed-comment-media-actions"><button type="button">Photo</button><button type="button">GIF</button></div>
            <input aria-label="Write a reply" placeholder="Post your reply" maxlength="1000" /></div>
            <button type="submit">Reply</button>
          </form>
        </section>
      </div>`);

    const input = page.getByRole('textbox', { name: 'Write a reply' });
    const draft = 'Long text '.repeat(75);
    await input.fill(draft);
    await input.focus();
    await page.setViewportSize({ width, height: 500 });
    await page.locator('.feed-comments-list').evaluate(el => { el.scrollTop = el.scrollHeight; });

    await expect(input).toBeFocused();
    await expect(input).toHaveValue(draft);
    await expect.poll(() => page.locator('.feed-comments-list').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    for (const element of [input, page.getByRole('button', { name: 'Reply', exact: true })]) {
      const bounds = await element.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(501);
    }

    await input.evaluate(el => el.blur());
    await page.setViewportSize({ width, height: 852 });
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue(draft);
    const restored = await input.boundingBox();
    expect(restored.y + restored.height).toBeLessThanOrEqual(853);
    await page.getByRole('button', { name: 'Close comments' }).click();
    await page.getByRole('dialog', { name: 'Comments' }).evaluate(el => el.remove());
    await expect(page.getByRole('dialog', { name: 'Comments' })).toHaveCount(0);
  });
}
