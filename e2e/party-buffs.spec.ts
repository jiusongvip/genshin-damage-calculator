import { expect, test } from '@playwright/test';
import { gotoCalculator, openTab, readExpected, waitForCalculator } from './helpers';

/**
 * The party-buff card. Two behaviours the brief called out and the pure tests
 * cannot show end to end: (1) a declared buff actually moves the headline, and
 * (2) an element-specific buff (Kazuha A4 on Pyro) does NOT leak onto Hu Tao's
 * Physical normal-attack rows — they are resolved per hit, not folded globally.
 */

const checkboxFor = (page: import('@playwright/test').Page, title: string) =>
  page.locator('label').filter({ hasText: title }).locator('input[type=checkbox]');

const normalTotal = (page: import('@playwright/test').Page) =>
  page.locator('#damage-table tr', { hasText: 'Total DMG' }).locator('td').last();

test.describe('party buffs', () => {
  test('Kazuha A4 (Pyro) lifts the Pyro headline but not the Physical normal rows', async ({ page }) => {
    await gotoCalculator(page); // Hu Tao, Damage tab, headline = Pyro burst
    const totalBefore = (await normalTotal(page).innerText()).trim();
    const headlineBefore = await readExpected(page);

    await openTab(page, 'Equipment');
    await checkboxFor(page, 'Kazuha').check();

    await openTab(page, 'Damage');
    await expect(normalTotal(page)).toHaveText(totalBefore); // Physical rows: untouched
    await expect.poll(() => readExpected(page)).toBeGreaterThan(headlineBefore); // Pyro headline: up
  });

  test('a declared buff is written to the URL and survives a reload', async ({ page }) => {
    await gotoCalculator(page);
    const before = await readExpected(page);

    await openTab(page, 'Equipment');
    await checkboxFor(page, 'Bennett').check();
    const buffed = await readExpected(page);
    expect(buffed).toBeGreaterThan(before);

    await expect.poll(() => new URL(page.url()).searchParams.get('pb')).toBe('1');

    await page.reload();
    await waitForCalculator(page);
    await expect.poll(() => readExpected(page)).toBe(buffed);
  });
});
