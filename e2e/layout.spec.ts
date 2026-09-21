import { expect, test } from '@playwright/test';
import { gotoCalculator, siteHeader } from './helpers';

/**
 * Both of these are silent failures: nothing errors, the layout just quietly
 * eats content. They were found by eye at 1280px, so they are pinned by
 * measurement.
 */

test.describe('header layout', () => {
  test('the brand name is not truncated at 1280px', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1280, 'the badge row only appears from xl');

    await page.goto('/');
    const title = siteHeader(page).locator('a[href="/"] span').first();
    const { clientWidth, scrollWidth } = await title.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));

    // `truncate` ellipsises as soon as scrollWidth exceeds clientWidth. The
    // regression was the title collapsing to ~40px while the badges held firm.
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    expect(clientWidth).toBeGreaterThan(150);
  });

  // The badge list is overflow-hidden, so a row that runs out of space clips the
  // last pill instead of wrapping it — at 1440px the four badges needed exactly
  // the row's full 1040px and "Data snapshot v7.0" lost its rounded end. This
  // walks the whole range where badges can appear, because the shell jumps by
  // 400px at the xl boundary and the failure was width-specific.
  //
  // Note the margin at 2xl is zero, not comfortable: the row is exactly full at
  // 1536px, so any growth in the title, a badge or the nav links fails here.
  for (const width of [1280, 1366, 1440, 1536, 1680, 1920]) {
    test(`the badge row is not clipped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const list = siteHeader(page).locator('ul[aria-label="Calculator highlights"]');
      const { clientWidth, scrollWidth } = await list.evaluate((el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // And the brand name must still survive alongside whatever badges fit.
      const title = siteHeader(page).locator('a[href="/"] span').first();
      const brand = await title.evaluate((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
      expect(brand.scrollWidth).toBeLessThanOrEqual(brand.clientWidth + 1);
    });
  }
});

test.describe('damage table', () => {
  test('signals that it scrolls instead of silently cutting a column off', async ({ page }) => {
    await gotoCalculator(page);

    const scroller = page.locator('#damage-table .overflow-x-auto');
    await expect(scroller).toBeVisible();

    // The table has a 560px floor and the panel is narrower than that on both
    // of the tested viewports, so this is the case the fade exists for.
    const hidden = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(hidden).toBeGreaterThan(0);

    // The reader has to be told there is more to the right.
    await expect(page.locator('#damage-table')).toContainText('Scroll sideways');

    await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await page.waitForTimeout(200);

    // Scrolled to the end, the cue is gone rather than stuck on.
    await expect(page.locator('#damage-table')).not.toContainText('Scroll sideways');
  });
});
