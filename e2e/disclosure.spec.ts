import { expect, test } from '@playwright/test';
import { openTab, waitForCalculator } from './helpers';

/**
 * Task 1 of the honesty pass: every effect that is shown as text but feeds no
 * number must say so, and a modelled effect must not shout about gaps.
 * State arrives through the calculator's own URL restore, so these do not
 * fight the picker dialogs.
 */

const gotoState = async (page: import('@playwright/test').Page, params: string) => {
  await page.goto(`/?${params}`);
  await waitForCalculator(page);
};

const consNote = (page: import('@playwright/test').Page) => page.getByTestId('constellation-note');

test.describe('modelling-gap disclosure', () => {
  test('an unmodelled constellation level says the number will not move', async ({ page }) => {
    await gotoState(page, 'c=baizhu&cn=2');
    await expect(consNote(page)).toHaveText('C2 not modelled — its text is shown, but it does not change the number.');

    // The talent bump is a real second channel — C3 must not be labelled a gap.
    await gotoState(page, 'c=baizhu&cn=3');
    await expect(consNote(page)).toHaveCount(0);
  });

  test('a modelled constellation stays quiet', async ({ page }) => {
    await gotoState(page, 'c=hu-tao&cn=6');
    await expect(consNote(page)).toHaveCount(0);
  });

  test('a weapon without a modelled passive says so in the Equipment tab', async ({ page }) => {
    await gotoState(page, 'c=baizhu&w=favonius-codex');
    await openTab(page, 'Equipment');
    await expect(page.getByText('Not modelled for damage')).toBeVisible();
  });

  test('a modelled weapon renders its effect instead of the note', async ({ page }) => {
    await gotoState(page, 'c=baizhu&w=jadefall-splendor');
    await openTab(page, 'Equipment');
    await expect(page.getByText('Not modelled for damage')).toHaveCount(0);
  });

  test('the constellation list marks which levels are text-only', async ({ page }) => {
    await gotoState(page, 'c=baizhu&cn=6');
    await openTab(page, 'Character');
    await page.locator('details summary').filter({ hasText: /Constellations/ }).click();
    const list = page.locator('details ul').first();
    // Four gaps (C1/C2/C4/C6); C3 and C5 feed the engine through the +3 bump.
    await expect(list.getByText('not modelled — text only')).toHaveCount(4);
    await expect(list.getByText('modelled', { exact: true })).toHaveCount(2);
  });

  /**
   * Brief #2 Task 1. The Miliastra pair are the only roster characters with
   * no per-hit talent table — genshin-db has none for them — so every figure
   * used to fall back to the placeholder multiplier in characters.ts and print
   * a confident number above an empty table. The notice replaces it in all
   * three places a number would sit; aether/lumine now have the real Traveler
   * (Anemo) table, so they read as supported.
   */
  test('a character with no talent data shows a notice, never a number', async ({ page }) => {
    await gotoState(page, 'c=manekin');
    await expect(page.locator('.damage-number')).toHaveCount(0);
    await expect(page.getByTestId('no-talent-note').first()).toContainText('No talent data');

    await openTab(page, 'Multipliers');
    await expect(page.locator('.damage-number')).toHaveCount(0);
  });

  test('a supported character keeps its headline and its per-hit table', async ({ page }) => {
    await gotoState(page, 'c=hu-tao');
    await expect(page.locator('.damage-number').first()).toBeVisible();
    const rows = page.locator('#damage-table tbody tr');
    expect(await rows.count()).toBeGreaterThan(10);
    await expect(rows.filter({ hasText: /1-Hit DMG/ }).first()).toBeVisible();
  });

  test('the Traveler prints the table its headline traces to', async ({ page }) => {
    await gotoState(page, 'c=aether');
    await expect(page.locator('.damage-number').first()).toBeVisible();
    await expect(page.getByTestId('no-talent-note')).toHaveCount(0);
    const rows = page.locator('#damage-table tbody tr');
    expect(await rows.count()).toBeGreaterThan(10);
    // The Gust Surge burst hit — real data, not the characters.ts placeholder.
    await expect(rows.filter({ hasText: 'Tornado DMG' }).first()).toBeVisible();
  });
});
