import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Google renders ~155-160 characters of a meta description and cuts the rest
// mid-sentence. The homepage shipped at 244, so this guard keeps every page —
// including ones added later — inside the renderable window.
const MAX_DESCRIPTION = 160;

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pageFiles(join(dir, e.name)) : e.name.endsWith('.astro') ? [join(dir, e.name)] : [],
  );
}

function descriptions(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/const description =\s*'([^']*)';/g)].map((m) => m[1]);
}

describe('page meta descriptions', () => {
  const pages = pageFiles(new URL('../pages', import.meta.url).pathname.replace(/^\//, ''));

  it('finds every page in the tree', () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
  });

  it.each(pages.map((f) => [f]))('%s declares exactly one description within the render width', (file) => {
    const found = descriptions(file);
    expect(found, 'expected exactly one `const description = \'...\';`').toHaveLength(1);
    expect(found[0].length, `description is ${found[0].length} chars`).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });
});
