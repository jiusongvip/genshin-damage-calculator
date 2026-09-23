import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared helpers for the smoke suite. Nothing here is a test itself — the file
 * has no `.spec.` in its name so Playwright does not collect it.
 */

/**
 * Not `header`: the Astro dev toolbar renders five `<header>` elements of its
 * own, so a bare `header` locator is a strict-mode violation. It does not
 * overlap anything clickable — `astro-dev-toolbar` is `display: contents` and
 * the back-to-top button hit-tests to itself — so the fix is to scope the
 * selector rather than to turn the toolbar off.
 */
export const siteHeader = (page: Page) => page.locator('#site-header');

/**
 * The calculator is a React island and the dev server compiles modules on
 * demand, so under parallel load `load` can fire well before the island is
 * interactive. Astro drops the `ssr` attribute on hydration, which is the
 * cheapest reliable signal.
 */
export async function waitForCalculator(page: Page) {
  await page.waitForFunction(
    () => {
      const island = document.querySelector('astro-island[component-url*="SingleCalculator"]');
      return island !== null && !island.hasAttribute('ssr');
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Land on the homepage with the calculator interactive. */
export async function gotoCalculator(page: Page) {
  await page.goto('/');
  await waitForCalculator(page);
}

/**
 * `html` carries `scroll-smooth`, so an anchor jump animates across tens of
 * thousands of pixels. Measuring before it settles reads a mid-flight position
 * — that is what made the navigation spec fail on its first run, not the page.
 */
export async function settleScroll(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as Window & { __y?: number; __still?: number };
      if (w.__y === window.scrollY) w.__still = (w.__still ?? 0) + 1;
      else {
        w.__still = 0;
        w.__y = window.scrollY;
      }
      return (w.__still ?? 0) >= 4;
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Reach the bottom without animating through 45,000px first. */
export async function scrollToBottom(page: Page) {
  await page.evaluate(() =>
    window.scrollTo({
      top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      behavior: 'instant',
    }),
  );
  await page.waitForTimeout(200);
}

/** The headline damage number in the scenario bar. */
export const expectedNumber = (page: Page) => page.locator('.damage-number').first();

/** Read the headline number as an integer, separators stripped. */
export async function readExpected(page: Page): Promise<number> {
  const text = await expectedNumber(page).innerText();
  return Number(text.replace(/[^0-9]/g, ''));
}

/** The input inside the `Pct` / `Num` field whose label starts with `label`. */
export const field = (page: Page, label: string) =>
  page.locator('label').filter({ hasText: label }).locator('input').first();

/**
 * Type into a `NumberField` and commit the edit. While focused the field keeps
 * the local string and feeds nothing to the draft — a commit happens on blur or
 * Enter — so `fill()` alone moves no numbers.
 */
export async function setField(page: Page, label: string, value: string) {
  const input = field(page, label);
  await input.fill(value);
  await input.press('Enter');
}

/** Switch the calculator's tab strip. */
export async function openTab(page: Page, name: 'Character' | 'Equipment' | 'Multipliers' | 'Damage') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveClass(/bg-forest-600/);
}
