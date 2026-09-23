import { expect, test } from '@playwright/test';
import { gotoCalculator, openTab, readExpected, setField, waitForCalculator } from './helpers';

/**
 * Shareable state is the product's promise: the homepage and FAQ both tell
 * people to copy the address bar. A regression once silently dropped the
 * write-back, so a link looked fine on the page but reproduced an empty panel
 * for everyone who clicked it. These guards pin the write side of the loop —
 * the read side is already covered by the character pages loading `/?c=`.
 */
test.describe('URL state', () => {
  test('edits are written to the address bar and survive a reload', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');

    await setField(page, 'Elemental / Physical DMG', '150');
    await setField(page, 'CRIT Rate bonus', '50');

    // The two edits land in the query string (as fractions, not percents).
    await expect.poll(() => new URL(page.url()).searchParams.get('db')).toBe('1.5');
    await expect.poll(() => new URL(page.url()).searchParams.get('cr')).toBe('0.5');

    const edited = await readExpected(page);

    await page.reload();
    await waitForCalculator(page);

    // Same URL, so the same headline — proving the read path agrees with the write path.
    await expect(new URL(page.url()).searchParams.get('db')).toBe('1.5');
    await expect.poll(() => readExpected(page)).toBe(edited);
  });

  test('a default panel writes no query string', async ({ page }) => {
    await gotoCalculator(page);
    await openTab(page, 'Multipliers');
    await setField(page, 'Elemental / Physical DMG', '150');
    await setField(page, 'Elemental / Physical DMG', '0');
    await expect.poll(() => new URL(page.url()).search).toBe('');
  });
});
