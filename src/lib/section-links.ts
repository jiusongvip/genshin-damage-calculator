/**
 * Homepage section anchors — `#calculator`, `#presets`, `#guides`, `#faq` —
 * only exist on `/`. The site header and footer are rendered by `BaseLayout`
 * on every page, so a bare hash there is a trap: on `/guides/builds/` the
 * browser resolves `#guides` against the current path, producing
 * `/guides/builds/#guides`, which matches no element and silently does
 * nothing. The link looks live and is dead.
 *
 * `sectionHref()` keeps the bare hash on the homepage (so clicking does not
 * trigger a reload) and makes it root-absolute everywhere else (so the browser
 * navigates to `/` and then scrolls to the section).
 */

/** `true` for the homepage regardless of trailing slash or an explicit index. */
export function isHomePath(pathname: string): boolean {
  const trimmed = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return trimmed === '' || trimmed === '/index.html';
}

/**
 * Resolve a homepage section hash against the page it is rendered on.
 * `sectionHref('#guides', '/guides/builds/')` → `'/#guides'`
 * `sectionHref('#guides', '/')`             → `'#guides'`
 */
export function sectionHref(hash: string, pathname: string): string {
  return isHomePath(pathname) ? hash : `/${hash}`;
}
