import { expect, test } from '@playwright/test';
import { openTab, readExpected, waitForCalculator } from './helpers';

/**
 * The self-state card end to end: Hu Tao's Skill toggle infuses her normal
 * attacks (the row dots turn Pyro), lifts the headline, and switching it off
 * restores the exact number. The maths is pinned in selfStates.test.ts.
 */
test('Hu Tao: Paramita Papilio infuses her normals and lifts the headline', async ({ page }) => {
  await page.goto('/?c=hu-tao');
  await waitForCalculator(page);
  const dot = page.getByTestId('row-element-combat1-0-1-hit-dmg');
  await expect(dot).toHaveAttribute('data-element', 'physical');
  const before = await readExpected(page);

  await openTab(page, 'Character');
  const toggle = page.getByTestId('self-states').getByRole('checkbox', { name: /Paramita Papilio/ });
  await toggle.check();
  await openTab(page, 'Damage');
  await expect(dot).toHaveAttribute('data-element', 'pyro');
  await expect.poll(() => readExpected(page)).toBeGreaterThan(before);
  await expect.poll(() => new URL(page.url()).searchParams.get('ss')).toBe('hu-tao-e');

  await openTab(page, 'Character');
  await toggle.uncheck();
  await expect.poll(() => readExpected(page)).toBe(before);
});

test('a character without modelled states shows no card', async ({ page }) => {
  await page.goto('/?c=bennett');
  await waitForCalculator(page);
  await openTab(page, 'Character');
  await expect(page.getByTestId('self-states')).toHaveCount(0);
});
