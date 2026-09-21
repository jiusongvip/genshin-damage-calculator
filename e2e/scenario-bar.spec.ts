import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { field, gotoCalculator, readExpected } from './helpers';

/**
 * The scenario bar — who is hitting, with what, at which level, against what.
 * It is the most-used control surface in the app and it has a wide, all-string
 * prop contract, so a prop wired to the wrong draft field type-checks cleanly.
 * These guards pin the wiring by watching the headline number move.
 */

/** The scenario bar's weapon picker — the only label that says "Weapon". */
const weaponSelect = (page: Page) => page.locator('label').filter({ hasText: 'Weapon' }).getByRole('button');

/** The enemy picker, anchored on its "Name · Lv85" accessible name. */
const enemySelect = (page: Page) => page.getByRole('button', { name: /· Lv\d+/ });

/**
 * The open dropdown. Scoping to it matters: the Constellation control is a
 * native `<select>`, whose `<option>`s also answer to the "option" role.
 */
const openListbox = (page: Page) => page.getByRole('listbox');

/**
 * Replace a numeric field's value in one keystroke. `fill()` clears the field
 * first, and an empty level input falls back to 90 — so React re-renders with
 * 90 and can clobber the value `fill()` just wrote. Selecting first and then
 * typing never produces that empty intermediate state.
 */
async function retype(input: Locator, value: string) {
  await input.selectText();
  await input.pressSequentially(value);
  await expect(input).toHaveValue(value);
}

test.describe('scenario bar', () => {
  test('the level control drives the headline number', async ({ page }) => {
    await gotoCalculator(page);

    const before = await readExpected(page);

    // Level 1 strips almost every base stat — the number must fall.
    const level = field(page, 'Level');
    await retype(level, '1');
    await expect.poll(() => readExpected(page)).toBeLessThan(before);

    await retype(level, '90');
    await expect.poll(() => readExpected(page)).toBe(before);
  });

  test('switching weapon changes the headline number', async ({ page }) => {
    await gotoCalculator(page);

    const expectedBefore = await readExpected(page);
    const weaponBefore = (await weaponSelect(page).innerText()).trim();

    await weaponSelect(page).click();
    // Any option other than the one already showing — same weapon type, so it
    // is a real swap rather than a no-op.
    await openListbox(page).getByRole('option').filter({ hasNotText: weaponBefore }).first().click();

    await expect(weaponSelect(page)).not.toHaveText(weaponBefore);
    await expect.poll(() => readExpected(page)).not.toBe(expectedBefore);
  });

  test('choosing the custom enemy reveals its level input', async ({ page }) => {
    await gotoCalculator(page);

    // A preset carries its own level, so there is nothing to type.
    await expect(page.getByLabel('Enemy level')).toHaveCount(0);

    await enemySelect(page).click();
    await openListbox(page).getByRole('option', { name: 'Custom…' }).click();

    await expect(page.getByLabel('Enemy level')).toBeVisible();
  });
});
