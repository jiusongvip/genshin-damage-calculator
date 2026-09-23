import { expect, test } from '@playwright/test';
import { gotoCalculator, openTab, readExpected, setField } from './helpers';

/**
 * Saved scenarios let a reader park one build and diff it against another
 * without a login. The whole feature rides on the Task 0 query string, so these
 * guards pin the loop the user actually performs: save → change → load restores
 * the number, and Compare lights the Diff column against the stored scenario.
 */
test.describe('saved scenarios', () => {
  test('save → edit → load restores the headline number', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');

    await setField(page, 'Elemental / Physical DMG', '150');
    const saved = await readExpected(page);

    await page.getByLabel('Scenario name').fill('My build');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const row = page.getByTestId('scenario-row').first();
    await expect(row).toContainText('My build');

    await setField(page, 'Elemental / Physical DMG', '0');
    await expect.poll(() => readExpected(page)).not.toBe(saved);

    await row.getByRole('button', { name: 'Load' }).click();
    await expect.poll(() => readExpected(page)).toBe(saved);
  });

  test('Compare against a saved scenario adds the Diff column', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');

    await setField(page, 'Elemental / Physical DMG', '150');
    await page.getByLabel('Scenario name').fill('base');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Move away from the saved state so the diff is non-zero.
    await setField(page, 'Elemental / Physical DMG', '300');

    await openTab(page, 'Damage');
    const table = page.locator('#damage-table');
    await expect(table).not.toContainText('Diff');

    await page.getByTestId('scenario-row').first().getByRole('button', { name: 'Compare' }).click();
    await expect(table).toContainText('Diff');
    await expect(page.getByRole('button', { name: 'Clear compare' })).toBeVisible();
  });
});
