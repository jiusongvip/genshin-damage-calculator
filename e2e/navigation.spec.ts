import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The homepage is ~21,700px tall on desktop and ~44,850px on mobile (24 and 53
 * viewports). That length is what makes navigation regressions here so costly:
 * the section anchors work perfectly, they just drop you tens of thousands of
 * pixels down with no way back. Each test below pins one of the escape routes.
 */

/**
 * `html` carries `scroll-smooth`, so an anchor jump animates across tens of
 * thousands of pixels. Measuring before it settles reads a mid-flight position
 * — that is what made this file fail on its first run, not the page.
 */
async function settleScroll(page: Page) {
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
async function scrollToBottom(page: Page) {
  await page.evaluate(() =>
    window.scrollTo({
      top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      behavior: 'instant',
    }),
  );
  await page.waitForTimeout(200);
}

/**
 * Not `header`: the Astro dev toolbar renders five `<header>` elements of its
 * own, so a bare `header` locator is a strict-mode violation rather than the
 * site header. `#site-header` is the one on the page that matters.
 */
const siteHeader = (page: Page) => page.locator('#site-header');

/** The desktop nav is `hidden lg:flex`, so a bare selector can match an
 *  invisible link and time out waiting to click it. */
const sectionLink = (page: Page, hash: string) => page.locator(`#site-header a[href$="${hash}"]:visible`).first();

test.describe('the header stays reachable', () => {
  test('is still pinned after scrolling to the bottom of the page', async ({ page }) => {
    await page.goto('/');
    const header = siteHeader(page);
    await expect(header).toBeVisible();

    await scrollToBottom(page);

    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(5000);

    // Sticky means it is still in the viewport, not 15,000px above it.
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(8);
  });

  test('a section anchor lands below the sticky header, not under it', async ({ page }) => {
    await page.goto('/');

    // Below lg the nav collapses into the hamburger, so the header has no
    // visible section link until the menu is open.
    const inline = sectionLink(page, '#guides');
    if (await inline.count()) {
      await inline.click();
    } else {
      await page.locator('#mobile-menu-btn').click();
      await page.locator('#mobile-nav a[href$="#guides"]').click();
    }
    await settleScroll(page);

    const top = await page.locator('#guides').evaluate((el) => el.getBoundingClientRect().top);
    const headerHeight = await siteHeader(page).evaluate((el) => el.getBoundingClientRect().height);

    // scroll-mt-20 keeps a 16px gap under the 64px header.
    expect(top).toBeGreaterThan(headerHeight);
    expect(top).toBeLessThan(headerHeight + 40);
  });
});

test.describe('mobile menu', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 1024, 'the hamburger only exists below lg');

  test('closes after choosing a section', async ({ page }) => {
    await page.goto('/');
    const menu = page.locator('#mobile-nav');
    await expect(menu).toBeHidden();

    await page.locator('#mobile-menu-btn').click();
    await expect(menu).toBeVisible();

    // A section link is a same-document jump, so the page never reloads and
    // nothing else would close the menu.
    await menu.locator('a').first().click();
    await expect(menu).toBeHidden();
  });
});

test.describe('back to top', () => {
  test('appears once the reader is deep in the page and returns them to the hero', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('#back-to-top');

    await expect(button).toBeHidden();

    await scrollToBottom(page);
    await expect(button).toBeVisible();

    await button.click();
    await settleScroll(page);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(4);
  });
});
