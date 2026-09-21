import { expect, test } from '@playwright/test';
import { field, gotoCalculator, openTab, readExpected } from './helpers';

/**
 * The calculator is the product; until now nothing in the suite touched it.
 * These are the guards that make it safe to restructure SingleCalculator.tsx:
 * they pin the tab strip, the six multiplier zones, and the two flows that
 * move state between zones (picking a damage row, editing a zone input).
 *
 * They assert behaviour, not markup, so a pure file split keeps them green.
 */

const ZONES = ['base', 'bonus', 'crit', 'reaction', 'def', 'res'] as const;

test.describe('calculator', () => {
  test('every tab renders its own panel', async ({ page }) => {
    await gotoCalculator(page);

    await openTab(page, 'Multipliers');
    await expect(page.locator('section#base')).toBeVisible();

    await openTab(page, 'Character');
    await expect(page.getByRole('heading', { name: 'Character stats' })).toBeVisible();

    await openTab(page, 'Equipment');
    await expect(page.getByRole('heading', { name: /Artifacts/ })).toBeVisible();

    await openTab(page, 'Damage');
    await expect(page.locator('#damage-table')).toBeVisible();
  });

  test('all six multiplier zones are present', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');

    // The zones are what this file is being split by — a bad split would drop
    // one and every other assertion in this suite would still pass.
    for (const id of ZONES) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }

    // Numbered 01..06, in order.
    for (const [i, id] of ZONES.entries()) {
      await expect(page.locator(`section#${id} h3`)).toContainText(String(i + 1).padStart(2, '0'));
    }
  });

  test('editing a zone changes the headline number, and reset restores it', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');

    const before = await readExpected(page);

    // Zone 2 is a straight multiplier on the hit, so +100% must raise the total.
    await field(page, 'Elemental / Physical DMG').fill('100');
    await expect.poll(() => readExpected(page)).toBeGreaterThan(before);

    // The zone shows an "edited" marker and offers a reset while it is off-default.
    await expect(page.locator('section#bonus')).toContainText('edited');
    await page.locator('section#bonus').getByRole('button', { name: 'reset' }).click();

    await expect.poll(() => readExpected(page)).toBe(before);
  });

  test('picking a damage row loads it into the multipliers', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Damage');

    const row = page.locator('#damage-table tbody tr').filter({ hasText: '1-Hit DMG' }).first();
    await row.click();

    // The picked row is marked, which is how the table shows what the zones
    // above are describing.
    await expect(row).toHaveClass(/bg-forest-500\/10/);

    // And its multiplier has replaced the default signature multiplier.
    await openTab(page, 'Multipliers');
    await expect(field(page, 'Skill multiplier')).not.toHaveValue('');
  });

  test('pinning a baseline adds the Diff column', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Damage');

    const table = page.locator('#damage-table');
    await expect(table).not.toContainText('Diff');

    await page.getByRole('button', { name: 'Pin baseline' }).click();

    await expect(page.getByRole('button', { name: 'Clear baseline' })).toBeVisible();
    await expect(table).toContainText('Diff');
  });
});
