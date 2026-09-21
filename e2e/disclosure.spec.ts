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
});
