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
  // The Average column used to sit past a 560px table floor in a 352px (phone)
  // or 510px (1280px desktop) panel, so the one number the reader came for was
  // sliced in half. It must now be fully on screen without scrolling.
  test('the Average column is on screen without scrolling', async ({ page }) => {
    await gotoCalculator(page);

    const scroller = page.locator('#damage-table .overflow-x-auto');
    await expect(scroller).toBeVisible();
    const hidden = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(hidden).toBeLessThanOrEqual(1);

    const box = await scroller.boundingBox();
    const avg = await page.locator('#damage-table thead th', { hasText: 'Average' }).boundingBox();
    expect(avg!.x + avg!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);

    // Non-CRIT and CRIT are still readable, folded under the attack name.
    await expect(page.locator('#damage-table tbody tr', { hasText: '1-Hit DMG' }).first()).toContainText('crit');
    await expect(page.locator('#damage-table')).not.toContainText('Scroll sideways');
  });

  test('the character page tables keep Average on screen too', async ({ page }) => {
    await page.goto('/characters/hu-tao/');
    for (const scroller of await page.locator('[data-testid=character-damage-table] .overflow-x-auto').all()) {
      expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
    const weapons = page.locator('section', { hasText: 'Weapon comparison' }).locator('.overflow-x-auto');
    expect(await weapons.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  });

  // If something (the Diff column) still pushes the table wider than its panel,
  // the reader has to be told — never a silently cut column.
  test('a table wider than its panel says so', async ({ page }) => {
    await gotoCalculator(page);
    await page.getByRole('button', { name: 'Pin baseline' }).click();

    const scroller = page.locator('#damage-table .overflow-x-auto');
    const hidden = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    const table = page.locator('#damage-table');
    if (hidden > 1) {
      await expect(table).toContainText('Scroll sideways');
      await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
      await page.waitForTimeout(200);
      await expect(table).not.toContainText('Scroll sideways');
    } else {
      await expect(table).not.toContainText('Scroll sideways');
    }
  });
});

test.describe('calculator shell', () => {
  test('the tab strip stays on one row', async ({ page }) => {
    await gotoCalculator(page);
    const tops = await page.getByRole('tab').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const heights = await page.getByRole('tab').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(page.viewportSize()!.width < 640 ? 36 : 24);
    // Against the configured viewport, not innerWidth: on an emulated phone an
    // overflowing page widens the layout viewport, so innerWidth grows with it.
    const scrollWidth = await page.evaluate(() => document.scrollingElement!.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('a short desktop window scrolls the page, not a box inside it', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'the fixed shell is desktop-only');
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoCalculator(page);
    const panel = page.locator('#calc-panel');
    const overflowY = await panel.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('visible');
  });
});
