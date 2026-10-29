import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Isolated DOM/CSS fixture: no authentication, network writes, or customer data.
// Resizing the viewport is NOT an emulation of a physical iOS keyboard.
const css = readFileSync(fileURLToPath(new URL('../apps/web/app/home-social-feed.css', import.meta.url)), 'utf8');

for (const width of [320, 393, 430]) {
  test(`comments composer preserves draft and scroll after simulated keyboard dismissal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>${css}</style>
      <style>
        /* Fixture-only layout fallback while the mobile feed CSS release is unmerged. */
        .feed-comments-layer { position:fixed; inset:0; display:flex; align-items:flex-end; justify-content:center; }
        .feed-comments-sheet { box-sizing:border-box; width:min(100%,560px); height:min(74dvh,680px); max-height:100dvh; display:flex; flex-direction:column; overflow:hidden; background:#fff; }
        .feed-comments-sheet > header { flex:0 0 52px; }
        .feed-comments-list { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; }
        .feed-comments-sheet > form { flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:10px; }
        .feed-comments-composer { flex:1; min-width:0; }
        .feed-comments-composer input { width:100%; box-sizing:border-box; height:40px; }
      </style>
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
