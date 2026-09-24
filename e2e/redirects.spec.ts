import { expect, test } from '@playwright/test';

/**
 * /how-damage-is-calculated/ was retired: it only rendered the same formula
 * component as /guides/damage-formula/, so it was a duplicate page. In
 * production Vercel answers it with a real 301 (vercel.json); these tests run
 * against the dev server, where the astro.config.mjs mirror serves the
 * jump page instead. Either way the visitor lands on the surviving guide.
 */
test('the retired formula URL ends up on the surviving guide', async ({ page }) => {
  await page.goto('/how-damage-is-calculated/');
  await expect(page).toHaveURL(/\/guides\/damage-formula\/$/);
  // Scoped to main: the Astro dev toolbar injects h1s of its own, and a bare
  // `h1` intermittently hit a strict-mode violation against them.
  await expect(page.locator('main h1')).toBeVisible();
});
