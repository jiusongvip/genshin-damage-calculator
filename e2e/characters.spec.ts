import { expect, test } from '@playwright/test';
import { waitForCalculator } from './helpers';

/**
 * Task 3: the static /characters/<id>/ pages. These are real routes (the
 * repo's first getStaticPaths set), so the suite checks the three things the
 * brief called out — the index is reachable, a page renders a non-empty table,
 * the calculator entry preloads the right character — plus one number-parity
 * assertion that the server-rendered table agrees with the live calculator.
 */

const readTotalDmg = (root: import('@playwright/test').Locator) =>
  root.locator('tr', { hasText: 'Total DMG' }).locator('td').last();

test.describe('character pages', () => {
  test('the /characters/ index lists linked characters', async ({ page }) => {
    await page.goto('/characters/');
    const links = page.locator('main a[href^="/characters/"]');
    expect(await links.count()).toBeGreaterThan(100);
    await expect(page.locator('a[href="/characters/hu-tao/"]').first()).toBeVisible();
  });

  test('a static character page renders a non-empty damage table without JS', async ({ page }) => {
    await page.goto('/characters/hu-tao/');
    const table = page.getByTestId('character-damage-table');
    const rows = table.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(10);
    await expect(table.locator('text=1-Hit DMG').first()).toBeVisible();
    // At least one computed, comma-grouped damage figure is present.
    await expect(readTotalDmg(table)).toContainText(/[\d,]{3,}/);
  });

  test('the calculator entry preloads the character', async ({ page }) => {
    await page.goto('/characters/hu-tao/');
    const entry = page.locator('a[href="/?c=hu-tao"]').first();
    await expect(entry).toBeVisible();
    await entry.click();
    await waitForCalculator(page);
    await expect(page.locator('.damage-number').first()).toBeVisible();
    await expect(page.locator('#damage-table tbody tr', { hasText: '1-Hit DMG' }).first()).toBeVisible();
  });

  // Three scaling families the brief asked to spot-check: HP carry, bow/charged
  // carry, DEF carry. The shared assembleDamageGroups makes them equal by
  // construction, so this is the drift canary between the static page and the
  // live calculator, one comma-grouped number per family.
  for (const [id, kind] of [
    ['hu-tao', 'HP'],
    ['ganyu', 'bow'],
    ['itto', 'DEF'],
  ]) {
    test(`the static table agrees with the calculator (${id}, ${kind} scaling)`, async ({ page }) => {
      await page.goto(`/characters/${id}/`);
      const table = page.getByTestId('character-damage-table');
      await expect(readTotalDmg(table)).toContainText(/[\d,]{3,}/);
      const staticTotal = (await readTotalDmg(table).innerText()).trim();

      await page.goto(`/?c=${id}`);
      await waitForCalculator(page);
      // The island hydrates before its ?c= restore effect has applied, so poll
      // until the calculator settles on this character's own number.
      await expect
        .poll(async () => (await readTotalDmg(page.locator('#damage-table')).innerText()).trim(), { timeout: 10_000 })
        .toBe(staticTotal);
    });
  }
});
